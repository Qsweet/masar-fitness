import { randomUUID } from "node:crypto";
import type { VerifiedPayment } from "@masar/domain";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDb, createOrder, expireDueOrders, markOrderPaid, type Db } from "./index";
import {
  createDigitalProgram,
  createPlan,
  createTestClub,
  type TestProduct,
} from "./test-support/commerce-fixtures";
import { failure, orderInput, testDatabaseUrl, unwrap } from "./test-support/commerce-orders";
import { resetCommerceTables } from "./test-support/reset-database";

const PLAN_PRICE = 90_000;
/** 21:30Z يوم 15 يونيو = 00:30 يوم 16 يونيو بتوقيت الرياض. */
const PAID_AT = new Date("2026-06-15T21:30:00Z");
const MINUTE_MS = 60_000;

let db: Db;
let clubId: string;
let plan: TestProduct;

beforeAll(async () => {
  db = createDb(testDatabaseUrl());
  await resetCommerceTables(db);
  clubId = await createTestClub(db);
  plan = await createPlan(db, clubId, {
    priceMinor: PLAN_PRICE,
    durationMonths: 3,
    bonusMonths: 1,
  });
});

beforeEach(async () => {
  await db.$executeRaw`
    TRUNCATE audit_logs, memberships, order_discounts, order_items, orders, customers CASCADE`;
});

afterAll(async () => {
  await resetCommerceTables(db);
  await db.$disconnect();
});

function payment(overrides: Partial<VerifiedPayment> = {}): VerifiedPayment {
  return {
    provider: "test_pay",
    providerPaymentId: randomUUID(),
    amountMinor: PLAN_PRICE,
    currency: "SAR",
    ...overrides,
  };
}

async function newOrder(slug = plan.slug, total = PLAN_PRICE): Promise<string> {
  return unwrap(await createOrder(db, orderInput(slug, total))).orderId;
}

function pay(orderId: string, verified = payment(), now = PAID_AT) {
  return markOrderPaid(db, { orderId, payment: verified, actor: "provider", now });
}

/** أفعال التدقيق مرتبة أبجديًا: سطور اللحظة الواحدة لا ترتيب زمني بينها. */
function auditActions(entityId: string): Promise<string[]> {
  return db.auditLog
    .findMany({ where: { entityId } })
    .then((rows) => rows.map((row) => row.action).sort());
}

describe("markOrderPaid: التفعيل", () => {
  it("ينشئ اشتراكًا واحدًا بتواريخ الرياض ويسلّم الطلب، والتكرار يرجع النتيجة نفسها", async () => {
    const orderId = await newOrder();
    const verified = payment();
    const paid = unwrap(await pay(orderId, verified));
    expect(paid).toMatchObject({ orderId, status: "fulfilled", replayed: false });
    const rows = await db.$queryRaw<{ status: string; starts_on: string; ends_on: string }[]>`
      SELECT status::text, starts_on::text, ends_on::text FROM memberships WHERE order_id = ${orderId}::uuid`;
    expect(rows).toEqual([{ status: "active", starts_on: "2026-06-16", ends_on: "2026-10-16" }]);
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order).toMatchObject({ status: "fulfilled", paidAt: PAID_AT, fulfilledAt: PAID_AT });
    expect(await auditActions(orderId)).toEqual([
      "order_created",
      "order_fulfilled",
      "payment_verified",
    ]);
    expect(await auditActions(paid.membershipId ?? "")).toEqual(["membership_created"]);
    const replay = unwrap(await pay(orderId, verified, new Date(PAID_AT.getTime() + MINUTE_MS)));
    expect(replay).toEqual({ ...paid, replayed: true });
    expect(await db.membership.count()).toBe(1);
  });

  it("الطلب الرقمي يبقى paid بلا اشتراك", async () => {
    const program = await createDigitalProgram(db, clubId, { priceMinor: PLAN_PRICE });
    const orderId = await newOrder(program.slug);
    const paid = unwrap(await pay(orderId));
    expect(paid).toMatchObject({ status: "paid", membershipId: null });
    expect(await db.membership.count()).toBe(0);
    expect(await auditActions(orderId)).toEqual(["order_created", "payment_verified"]);
  });

  it("on_first_visit يعطي اشتراكًا مجدولًا بلا تواريخ", async () => {
    const club = await createTestClub(db, { membershipStartRule: "on_first_visit" });
    const own = await createPlan(db, club, { priceMinor: PLAN_PRICE, durationMonths: 1 });
    const paid = unwrap(await pay(await newOrder(own.slug)));
    const membership = await db.membership.findUniqueOrThrow({
      where: { id: paid.membershipId ?? "" },
    });
    expect(membership).toMatchObject({ status: "scheduled", startsOn: null, endsOn: null });
  });

  it("العميل ذو الاشتراك الحي يحصل على اشتراك مجدول لا متراكب", async () => {
    unwrap(await pay(await newOrder()));
    const second = unwrap(await pay(await newOrder()));
    const membership = await db.membership.findUniqueOrThrow({
      where: { id: second.membershipId ?? "" },
    });
    expect(membership).toMatchObject({ status: "scheduled", startsOn: null });
    const audit = await db.auditLog.findFirstOrThrow({ where: { entityId: membership.id } });
    expect(audit.data).toMatchObject({ reason: "renewal_rule_undecided" });
  });

  it.each(["partially_refunded", "refunded"] as const)(
    "إعادة الدفعة نفسها بعد %s ترجع الحالة الفعلية بلا كتابة ولا عطل",
    async (status) => {
      const orderId = await newOrder();
      const verified = payment();
      const paid = unwrap(await pay(orderId, verified));
      // لا كاتب استرداد في هذه المرحلة: الحالة تُكتب مباشرة كما ستكتبها المرحلة 4
      await db.$executeRaw`UPDATE orders SET status = ${status}::order_status WHERE id = ${orderId}::uuid`;
      const before = await auditActions(orderId);
      const replay = unwrap(await pay(orderId, verified));
      expect(replay).toEqual({ ...paid, status, replayed: true });
      expect(await auditActions(orderId)).toEqual(before);
      expect(await db.membership.count()).toBe(1);
    },
  );
});

describe("markOrderPaid: الرفض يُكتب في التدقيق ويُعتمد", () => {
  it("already_paid لدفعة أخرى على طلب مدفوع", async () => {
    const orderId = await newOrder();
    unwrap(await pay(orderId));
    const again = failure(await pay(orderId));
    expect(again).toMatchObject({ code: "conflict", reason: "order.already_paid" });
    expect(await auditActions(orderId)).toContain("payment_rejected");
  });

  it("already_used لدفعة سُجّلت على طلب آخر", async () => {
    const verified = payment();
    unwrap(await pay(await newOrder(), verified));
    const other = await newOrder();
    const used = failure(await pay(other, verified));
    expect(used).toMatchObject({ code: "conflict", reason: "payment.already_used" });
    expect(await db.order.findUniqueOrThrow({ where: { id: other } })).toMatchObject({
      status: "pending_payment",
      paidAt: null,
    });
  });

  it("المبلغ أو العملة المخالفة: رفض مع سطر تدقيق فيه بيانات الدفعة", async () => {
    const orderId = await newOrder();
    const short = payment({ amountMinor: PLAN_PRICE - 1 });
    expect(failure(await pay(orderId, short)).reason).toBe("payment.amount_mismatch");
    const foreign = failure(await pay(orderId, payment({ currency: "USD" })));
    expect(foreign.reason).toBe("payment.currency_mismatch");
    const rejected = await db.auditLog.findMany({
      where: { entityId: orderId, action: "payment_rejected" },
    });
    expect(rejected.map((row) => row.data)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ amountMinor: PLAN_PRICE - 1, reason: "payment.amount_mismatch" }),
        expect.objectContaining({ currency: "USD", reason: "payment.currency_mismatch" }),
      ]),
    );
    expect(rejected).toHaveLength(2);
    expect(rejected[0]).toMatchObject({ fromState: "pending_payment", toState: null });
    expect(await db.order.findUniqueOrThrow({ where: { id: orderId } })).toMatchObject({
      status: "pending_payment",
    });
  });

  it("not_payable لطلب منتهٍ، بلا اشتراك", async () => {
    const orderId = await newOrder();
    const expired = await expireDueOrders(db, { now: PAID_AT, limit: 10 });
    expect(expired).toBe(1);
    const late = failure(await pay(orderId));
    expect(late).toMatchObject({ code: "conflict", reason: "order.not_payable" });
    expect(await db.membership.count()).toBe(0);
    expect(await auditActions(orderId)).toEqual([
      "order_created",
      "order_expired",
      "payment_rejected",
    ]);
  });

  it("طلب غير موجود: not_found", async () => {
    const missing = failure(await pay(randomUUID()));
    expect(missing).toMatchObject({ code: "not_found", reason: "order.not_found" });
  });
});
