import type { ProviderSessionSnapshot } from "@masar/domain";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createDb,
  createOrder,
  createPaymentAttempt,
  getOrderPaymentSummary,
  markOrderPaid,
  type Db,
  type PaymentAttemptRecord,
  type SyncOutcome,
} from "./index";
import {
  createPlan,
  createTestClub,
  TEST_NOW,
  type TestProduct,
} from "./test-support/commerce-fixtures";
import {
  createDbClients,
  disconnectAll,
  orderInput,
  testBuyer,
  testDatabaseUrl,
  testPhone,
  unwrap,
} from "./test-support/commerce-orders";
import {
  applyTestSnapshot,
  openTestAttempt,
  paymentSnapshot,
  sessionSnapshot,
  TEST_MIN_PAYMENT_MINUTES,
  TEST_PROVIDER,
  TEST_STUCK_AFTER_MS,
  testPaymentId,
} from "./test-support/payments-fixtures";
import { resetCommerceTables } from "./test-support/reset-database";

const PLAN_PRICE = 90_000;
const MINUTE_MS = 60_000;
const CLIENTS = 20;
const SYNC_AT = new Date(TEST_NOW.getTime() + 3 * MINUTE_MS);

let db: Db;
let clients: Db[];
let plan: TestProduct;
let phoneIndex = 0;

beforeAll(async () => {
  db = createDb(testDatabaseUrl());
  clients = createDbClients(CLIENTS);
  await resetCommerceTables(db);
  const clubId = await createTestClub(db);
  plan = await createPlan(db, clubId, { priceMinor: PLAN_PRICE, durationMonths: 1 });
});

beforeEach(async () => {
  await db.$executeRaw`
    TRUNCATE audit_logs, memberships, order_discounts, order_items, orders, customers CASCADE`;
});

afterAll(async () => {
  await resetCommerceTables(db);
  await disconnectAll(clients);
  await db.$disconnect();
});

/** طلب معلّق ومحاولة pending فُتحت جلستها عند المزوّد. */
async function pendingAttempt(): Promise<PaymentAttemptRecord> {
  phoneIndex += 1;
  const input = orderInput(plan.slug, PLAN_PRICE, { buyer: testBuyer(testPhone(phoneIndex)) });
  return openTestAttempt(db, unwrap(await createOrder(db, input)).orderId);
}

function apply(
  attempt: PaymentAttemptRecord,
  snapshot: ProviderSessionSnapshot,
  now = SYNC_AT,
  client = db,
): Promise<SyncOutcome> {
  return applyTestSnapshot(client, attempt, snapshot, now);
}

function paid(attempt: PaymentAttemptRecord): ProviderSessionSnapshot {
  return sessionSnapshot(attempt, [paymentSnapshot(attempt, "paid")]);
}

function attemptRow(attempt: PaymentAttemptRecord) {
  return db.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
}

function orderRow(attempt: PaymentAttemptRecord) {
  return db.order.findUniqueOrThrow({ where: { id: attempt.orderId } });
}

function auditCount(entityId: string, action: string): Promise<number> {
  return db.auditLog.count({ where: { entityId, action } });
}

function incidentKinds(attempt: PaymentAttemptRecord): Promise<string[]> {
  return db.paymentIncident
    .findMany({ where: { attemptId: attempt.id } })
    .then((rows) => rows.map((row) => row.kind).sort());
}

describe("applyProviderSnapshot: الدفع الناجح مرة واحدة", () => {
  it("دفعة مدفوعة مطابقة: محاولة captured مسوّاة، وطلب مسلَّم، واشتراك واحد", async () => {
    const attempt = await pendingAttempt();
    const result = await apply(attempt, paid(attempt));
    expect(result).toMatchObject({
      previousStatus: "pending",
      status: "captured",
      action: "settle",
      settlement: "paid",
      openedIncidents: [],
      paidOrder: { status: "fulfilled", replayed: false },
    });
    expect(await attemptRow(attempt)).toMatchObject({
      status: "captured",
      providerPaymentId: testPaymentId(attempt.id),
      providerStatus: "open",
      method: "creditcard",
      settledAt: SYNC_AT,
      settlementResult: "paid",
      capturedAt: SYNC_AT,
      syncLeaseUntil: null,
      checkCount: 1,
    });
    expect(await orderRow(attempt)).toMatchObject({
      status: "fulfilled",
      paidProvider: TEST_PROVIDER,
      paidProviderPaymentId: testPaymentId(attempt.id),
      paidAmountMinor: PLAN_PRICE,
    });
    expect(await db.membership.count({ where: { orderId: attempt.orderId } })).toBe(1);
    expect(await auditCount(attempt.id, "payment_attempt_captured")).toBe(1);
    expect(await auditCount(attempt.id, "payment_attempt_settled")).toBe(1);
  });

  it("إعادة الإشعار نفسه ثلاث مرات: لا تسوية ثانية ولا اشتراك ثانٍ", async () => {
    const attempt = await pendingAttempt();
    await apply(attempt, paid(attempt));
    for (let round = 0; round < 3; round += 1) {
      const replay = await apply(attempt, paid(attempt), new Date(SYNC_AT.getTime() + round + 1));
      expect(replay).toMatchObject({ action: "ignore", settlement: null, status: "captured" });
    }
    expect(await db.membership.count()).toBe(1);
    expect(await auditCount(attempt.orderId, "payment_verified")).toBe(1);
    expect(await auditCount(attempt.id, "payment_attempt_settled")).toBe(1);
    expect(await attemptRow(attempt)).toMatchObject({ settledAt: SYNC_AT, checkCount: 4 });
  });

  it("عشرون تحققًا متزامنًا: markOrderPaid تفعّل مرة والباقي replayed أو متجاهَل", async () => {
    const attempt = await pendingAttempt();
    const outcomes = await Promise.all(
      clients.map((client) => apply(attempt, paid(attempt), SYNC_AT, client)),
    );
    expect(outcomes.filter((result) => result.settlement === "paid")).toHaveLength(1);
    const others = outcomes.filter((result) => result.settlement !== "paid");
    expect(others.every((result) => [null, "replayed"].includes(result.settlement))).toBe(true);
    expect(await db.membership.count()).toBe(1);
    expect(await auditCount(attempt.orderId, "payment_verified")).toBe(1);
    expect(await auditCount(attempt.id, "payment_attempt_settled")).toBe(1);
    expect(await auditCount(attempt.id, "payment_attempt_captured")).toBe(1);
    expect(await db.paymentIncident.count()).toBe(0);
    const row = await attemptRow(attempt);
    expect(["paid", "replayed"]).toContain(row.settlementResult);
  });

  it("انقطاع بين markOrderPaid وتسجيل التسوية: الإعادة تكمل بـreplayed بلا أثر مزدوج", async () => {
    const attempt = await pendingAttempt();
    const paymentId = testPaymentId(attempt.id);
    // ما تتركه العملية إن توقفت بعد الخطوتين 1 و2: محاولة captured بلا تسوية وطلب مدفوع
    await db.paymentAttempt.update({
      where: { id: attempt.id },
      data: { status: "captured", providerPaymentId: paymentId, capturedAt: SYNC_AT },
    });
    const payment = {
      provider: TEST_PROVIDER,
      providerPaymentId: paymentId,
      amountMinor: PLAN_PRICE,
      currency: "SAR",
    };
    unwrap(
      await markOrderPaid(db, {
        orderId: attempt.orderId,
        payment,
        actor: "provider",
        now: SYNC_AT,
      }),
    );
    expect((await getOrderPaymentSummary(db, attempt.orderId)).liveAttempt?.status).toBe(
      "captured",
    );
    const resumed = await apply(attempt, paid(attempt), new Date(SYNC_AT.getTime() + MINUTE_MS));
    expect(resumed).toMatchObject({ settlement: "replayed", paidOrder: { replayed: true } });
    expect(await db.membership.count()).toBe(1);
    expect(await auditCount(attempt.orderId, "payment_verified")).toBe(1);
    expect((await getOrderPaymentSummary(db, attempt.orderId)).liveAttempt).toBeNull();
  });

  it("دفعة مدفوعة على محاولة انتهت جلستها والطلب ما زال معلّقًا: يُفعَّل الطلب مرة والمحاولة تبقى expired", async () => {
    const attempt = await pendingAttempt();
    await apply(attempt, sessionSnapshot(attempt, [], { state: "closed", rawStatus: "expired" }));
    expect((await attemptRow(attempt)).status).toBe("expired");
    const late = await apply(attempt, paid(attempt), new Date(SYNC_AT.getTime() + MINUTE_MS));
    expect(late).toMatchObject({ status: "expired", settlement: "paid" });
    expect(await attemptRow(attempt)).toMatchObject({
      status: "expired",
      settlementResult: "paid",
    });
    expect((await orderRow(attempt)).status).toBe("fulfilled");
    expect(await db.membership.count()).toBe(1);
  });
});

describe("applyProviderSnapshot: بلا دفعة مدفوعة", () => {
  it("جلسة مفتوحة: تبقى pending ويُعدّ الفحص", async () => {
    const attempt = await pendingAttempt();
    const result = await apply(
      attempt,
      sessionSnapshot(attempt, [paymentSnapshot(attempt, "in_progress")]),
    );
    expect(result).toMatchObject({ action: "update", status: "pending", settlement: null });
    expect(await attemptRow(attempt)).toMatchObject({ checkCount: 1, lastCheckedAt: SYNC_AT });
    expect((await getOrderPaymentSummary(db, attempt.orderId)).liveAttempt?.status).toBe("pending");
  });

  it("جلسة مغلقة ودفعة فاشلة: failed بسببه، والطلب معلّق ويقبل محاولة جديدة", async () => {
    const attempt = await pendingAttempt();
    const closed = sessionSnapshot(attempt, [paymentSnapshot(attempt, "failed")], {
      state: "closed",
      rawStatus: "expired",
    });
    expect(await apply(attempt, closed)).toMatchObject({ status: "failed" });
    expect(await attemptRow(attempt)).toMatchObject({
      status: "failed",
      failureReason: "payment_failed",
      endedAt: SYNC_AT,
      providerStatus: "expired",
    });
    expect(await auditCount(attempt.id, "payment_attempt_failed")).toBe(1);
    expect(await getOrderPaymentSummary(db, attempt.orderId)).toMatchObject({
      liveAttempt: null,
      lastAttemptFailed: true,
      hasOpenIncident: false,
    });
    const retry = await createPaymentAttempt(db, {
      orderId: attempt.orderId,
      provider: TEST_PROVIDER,
      providerMode: "test",
      minPaymentMinutes: TEST_MIN_PAYMENT_MINUTES,
      now: SYNC_AT,
    });
    expect(unwrap(retry).reused).toBe(false);
  });

  it("جلسة مغلقة بلا دفعات: expired", async () => {
    const attempt = await pendingAttempt();
    const result = await apply(attempt, sessionSnapshot(attempt, [], { state: "closed" }));
    expect(result).toMatchObject({ previousStatus: "pending", status: "expired" });
    expect(await attemptRow(attempt)).toMatchObject({ failureReason: null, endedAt: SYNC_AT });
  });

  it("محاولة عالقة بعد الموعد والعتبة: حادثة stuck_pending مرة، وتبقى حيّة", async () => {
    const attempt = await pendingAttempt();
    const stuck = sessionSnapshot(attempt, [paymentSnapshot(attempt, "in_progress")]);
    const alertAt = new Date(attempt.deadlineAt.getTime() + TEST_STUCK_AFTER_MS);
    const before = await apply(attempt, stuck, new Date(alertAt.getTime() - 1));
    expect(before.openedIncidents).toEqual([]);
    expect((await apply(attempt, stuck, alertAt)).openedIncidents).toEqual(["stuck_pending"]);
    const next = await apply(attempt, stuck, new Date(alertAt.getTime() + MINUTE_MS));
    expect(next).toMatchObject({ status: "pending", openedIncidents: [] });
    expect(await incidentKinds(attempt)).toEqual(["stuck_pending"]);
  });

  it("عكس لاحق من المزوّد: حادثة provider_reversed والمحاولة voided، والطلب لا يتغير", async () => {
    const attempt = await pendingAttempt();
    await apply(attempt, paid(attempt));
    const reversed = sessionSnapshot(attempt, [paymentSnapshot(attempt, "voided")]);
    const result = await apply(attempt, reversed, new Date(SYNC_AT.getTime() + MINUTE_MS));
    expect(result).toMatchObject({
      previousStatus: "captured",
      status: "voided",
      settlement: null,
      openedIncidents: ["provider_reversed"],
    });
    expect((await orderRow(attempt)).status).toBe("fulfilled");
    expect(await db.membership.count()).toBe(1);
    expect(await attemptRow(attempt)).toMatchObject({ status: "voided", settlementResult: "paid" });
  });
});
