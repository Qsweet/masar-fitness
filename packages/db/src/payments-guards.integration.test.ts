import { randomUUID } from "node:crypto";
import { ATTEMPT_STATUSES, INCIDENT_KINDS, isLiveAttempt } from "@masar/domain";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDb, type Db } from "./index";
import { writeAudit } from "./commerce/audit";
import {
  createPlan,
  createTestClub,
  expireRawOrder,
  insertRawOrder,
  markRawPaid,
  TEST_NOW,
  type TestProduct,
} from "./test-support/commerce-fixtures";
import { testDatabaseUrl } from "./test-support/commerce-orders";
import { openIncident } from "./payments/incidents";
import {
  insertRawAttempt,
  setRawAttempt,
  type RawAttemptInput,
} from "./test-support/payments-fixtures";
import { resetCommerceTables } from "./test-support/reset-database";

const PLAN_PRICE = 90_000;
const MINUTE_MS = 60_000;
const LATER = new Date(TEST_NOW.getTime() + MINUTE_MS);

let db: Db;
let clubId: string;
let plan: TestProduct;
let orderId: string;

beforeAll(async () => {
  db = createDb(testDatabaseUrl());
  await resetCommerceTables(db);
  clubId = await createTestClub(db);
  plan = await createPlan(db, clubId, { priceMinor: PLAN_PRICE, durationMonths: 1 });
});

beforeEach(async () => {
  await db.$executeRaw`
    TRUNCATE audit_logs, memberships, order_discounts, order_items, orders, customers CASCADE`;
  orderId = await newOrder();
});

afterAll(async () => {
  await resetCommerceTables(db);
  await db.$disconnect();
});

async function newOrder(): Promise<string> {
  const order = await insertRawOrder(db, {
    clubId,
    lines: [{ product: plan }],
    createdAt: TEST_NOW,
  });
  return order.orderId;
}

function insertAttempt(client: Db, target: string, overrides: Partial<RawAttemptInput> = {}) {
  return insertRawAttempt(client, {
    clubId,
    orderId: target,
    amountMinor: PLAN_PRICE,
    ...overrides,
  });
}

function setAttempt(id: string, assignment: string) {
  return setRawAttempt(db, id, assignment);
}

const TO_PENDING = "status = 'pending', provider_session_id = 's-1'";
const TO_EXPIRED = "status = 'expired', ended_at = now()";

describe("المحاولة الحيّة: تعريف القاعدة يطابق المجال", () => {
  it.each(
    ATTEMPT_STATUSES.flatMap((status) =>
      [true, false].map((settled) => [status, settled] as const),
    ),
  )("%s (مسوّاة: %s)", async (status, settled) => {
    const rows = await db.$queryRaw<{ live: boolean }[]>`
        SELECT payment_attempt_is_live(${status}::payment_attempt_status,
          ${settled ? TEST_NOW : null}::timestamptz) AS live`;
    expect(rows[0]?.live).toBe(isLiveAttempt(status, settled));
  });
});

describe("T9: الطلب لا يُكتب منتهيًا ومعه محاولة حيّة", () => {
  it("UPDATE مباشر إلى expired مرفوض ما دامت المحاولة حيّة، ومقبول بعد نهايتها", async () => {
    const attempt = await insertAttempt(db, orderId);
    await expect(expireRawOrder(db, orderId)).rejects.toThrow(
      "order_expiry_blocked_by_live_attempt",
    );
    await setAttempt(attempt.id, TO_PENDING);
    await expect(expireRawOrder(db, orderId)).rejects.toThrow(
      "order_expiry_blocked_by_live_attempt",
    );
    await setAttempt(attempt.id, TO_EXPIRED);
    await expireRawOrder(db, orderId);
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe("expired");
  });

  it("الدفع نفسه لا يمنعه السدّ: المحاولة الحيّة لا تحجب paid", async () => {
    await insertAttempt(db, orderId);
    await markRawPaid(db, orderId, { paidAt: TEST_NOW });
    expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("paid");
  });
});

describe("T10: الحوادث للإلحاق والحسم مرة", () => {
  let attemptId: string;

  beforeEach(async () => {
    attemptId = (await insertAttempt(db, orderId)).id;
  });

  function open(kind: (typeof INCIDENT_KINDS)[number], target = attemptId) {
    const note = { kind, data: { providerPaymentId: "p-1", amountMinor: PLAN_PRICE } };
    return db.$transaction((tx) =>
      openIncident(tx, { clubId, orderId, attemptId: target }, note, TEST_NOW),
    );
  }

  it("كل نوع معروف يُفتح مرة لكل محاولة، والتكرار بلا أثر", async () => {
    for (const kind of INCIDENT_KINDS) {
      expect(await open(kind)).toBe(true);
      expect(await open(kind)).toBe(false);
    }
    expect(await db.paymentIncident.count({ where: { attemptId } })).toBe(INCIDENT_KINDS.length);
  });

  it("نوع غير معروف، وبيانات ليست كائنًا، مرفوضان", async () => {
    const base = { clubId, orderId, attemptId, openedAt: TEST_NOW };
    await expect(
      db.paymentIncident.create({ data: { ...base, kind: "made_up", data: {} } }),
    ).rejects.toThrow("payment_incidents_kind_known");
    await expect(
      db.paymentIncident.create({ data: { ...base, kind: "stuck_pending", data: [] } }),
    ).rejects.toThrow("payment_incidents_data_object");
  });

  it("بيانات فيها اسم أو جوال لا تُكتب", async () => {
    const note = { kind: "amount_mismatch", data: { customerPhone: "+966512345678" } } as const;
    const write = db.$transaction((tx) =>
      openIncident(tx, { clubId, orderId, attemptId }, note, TEST_NOW),
    );
    await expect(write).rejects.toThrow("audit.personal_data");
  });

  it("محاولة طلب آخر، أو نادٍ آخر، مرفوضان", async () => {
    const otherOrder = await newOrder();
    const foreign = await insertAttempt(db, otherOrder);
    await expect(open("amount_mismatch", foreign.id)).rejects.toThrow(
      "payment_incident_reference_mismatch",
    );
    const otherClub = await createTestClub(db);
    const base = { orderId, attemptId, kind: "stuck_pending", data: {}, openedAt: TEST_NOW };
    await expect(
      db.paymentIncident.create({ data: { ...base, clubId: otherClub } }),
    ).rejects.toThrow("payment_incident_reference_mismatch");
  });

  it("الحادثة لا تُعدَّل ولا تُحذف، والحسم كامل ومرة واحدة", async () => {
    await open("amount_mismatch");
    const incident = await db.paymentIncident.findFirstOrThrow({ where: { attemptId } });
    const where = { id: incident.id };
    await expect(
      db.paymentIncident.update({ where, data: { kind: "stuck_pending" } }),
    ).rejects.toThrow("payment_incident_append_only");
    await expect(db.paymentIncident.update({ where, data: { data: {} } })).rejects.toThrow(
      "payment_incident_append_only",
    );
    await expect(db.paymentIncident.update({ where, data: { resolvedAt: LATER } })).rejects.toThrow(
      "payment_incidents_resolution_complete",
    );
    const resolved = { resolvedAt: LATER, resolution: "refunded_at_provider", resolvedBy: "owner" };
    await db.paymentIncident.update({ where, data: resolved });
    await expect(
      db.paymentIncident.update({ where, data: { resolution: "activated_manually" } }),
    ).rejects.toThrow("payment_incident_resolution_final");
    await expect(db.paymentIncident.delete({ where })).rejects.toThrow(
      "payment_incident_delete_forbidden",
    );
  });
});

describe("التدقيق يقبل كيان محاولة الدفع", () => {
  it("payment_attempt مقبول، وكيان غير معروف مرفوض", async () => {
    const entry = {
      clubId,
      entityId: randomUUID(),
      action: "payment_attempt_created",
      fromState: null,
      toState: "created",
      actor: "system",
      data: {},
      at: TEST_NOW,
    } as const;
    await db.$transaction((tx) => writeAudit(tx, { ...entry, entityType: "payment_attempt" }));
    expect(await db.auditLog.count({ where: { entityType: "payment_attempt" } })).toBe(1);
    const unknown = db.auditLog.create({
      data: {
        clubId,
        entityType: "payment_event",
        entityId: entry.entityId,
        action: entry.action,
        actor: entry.actor,
        createdAt: TEST_NOW,
      },
    });
    await expect(unknown).rejects.toThrow("audit_logs_entity_type_known");
  });
});
