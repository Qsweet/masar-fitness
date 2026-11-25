import type { ProviderSessionSnapshot } from "@masar/domain";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  applyProviderSnapshot,
  createDb,
  createOrder,
  getOrderPaymentSummary,
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
  failure,
  orderInput,
  testBuyer,
  testDatabaseUrl,
  testPhone,
  unwrap,
} from "./test-support/commerce-orders";
import {
  applyTestSnapshot,
  forceExpireOrder,
  openTestAttempt,
  paymentSnapshot,
  sessionSnapshot,
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

describe("applyProviderSnapshot: الرفض حادثة بلا تفعيل", () => {
  it("مبلغ لا يطابق: لا تفعيل، وتدقيق payment_rejected، وحادثة amount_mismatch مرة واحدة", async () => {
    const attempt = await pendingAttempt();
    const short = sessionSnapshot(attempt, [
      paymentSnapshot(attempt, "paid", { amountMinor: PLAN_PRICE - 100 }),
    ]);
    const result = await apply(attempt, short);
    expect(result).toMatchObject({
      status: "captured",
      settlement: "payment.amount_mismatch",
      paidOrder: null,
      openedIncidents: ["amount_mismatch"],
    });
    expect(await orderRow(attempt)).toMatchObject({ status: "pending_payment", paidAt: null });
    expect(await db.membership.count()).toBe(0);
    expect(await auditCount(attempt.orderId, "payment_rejected")).toBe(1);
    const incident = await db.paymentIncident.findFirstOrThrow({
      where: { attemptId: attempt.id },
    });
    expect(incident).toMatchObject({ kind: "amount_mismatch", orderId: attempt.orderId });
    expect(incident.data).toMatchObject({
      reason: "payment.amount_mismatch",
      provider: TEST_PROVIDER,
      providerPaymentId: testPaymentId(attempt.id),
      amountMinor: PLAN_PRICE - 100,
      currency: "SAR",
    });
    const again = await apply(attempt, short, new Date(SYNC_AT.getTime() + MINUTE_MS));
    expect(again).toMatchObject({ action: "ignore", openedIncidents: [] });
    expect(await auditCount(attempt.orderId, "payment_rejected")).toBe(1);
    expect(await getOrderPaymentSummary(db, attempt.orderId)).toMatchObject({
      liveAttempt: null,
      hasOpenIncident: true,
    });
  });

  it("عملة مخالفة: حادثة currency_mismatch", async () => {
    const attempt = await pendingAttempt();
    const foreign = sessionSnapshot(attempt, [
      paymentSnapshot(attempt, "paid", { currency: "USD" }),
    ]);
    const result = await apply(attempt, foreign);
    expect(result).toMatchObject({ settlement: "payment.currency_mismatch" });
    expect(await incidentKinds(attempt)).toEqual(["currency_mismatch"]);
    expect((await orderRow(attempt)).status).toBe("pending_payment");
  });

  it("كوبون طبّقه المزوّد فنقص المبلغ: حادثتان ولا تفعيل", async () => {
    const attempt = await pendingAttempt();
    const discounted = paymentSnapshot(attempt, "paid", {
      amountMinor: PLAN_PRICE - 1_000,
      couponApplied: true,
    });
    await apply(attempt, sessionSnapshot(attempt, [discounted]));
    expect(await incidentKinds(attempt)).toEqual(["amount_mismatch", "coupon_applied_by_provider"]);
    expect(await db.membership.count()).toBe(0);
  });

  it("دفعة متأخرة على طلب منتهٍ: order.not_payable وحادثة، بلا اشتراك", async () => {
    const attempt = await pendingAttempt();
    await forceExpireOrder(db, attempt.orderId);
    const result = await apply(attempt, paid(attempt));
    expect(result).toMatchObject({
      status: "captured",
      settlement: "order.not_payable",
      paidOrder: null,
      openedIncidents: ["late_payment_not_payable"],
    });
    expect((await orderRow(attempt)).status).toBe("expired");
    expect(await db.membership.count()).toBe(0);
    const rejected = await db.auditLog.findFirstOrThrow({
      where: { entityId: attempt.orderId, action: "payment_rejected" },
    });
    expect(rejected.data).toMatchObject({
      reason: "order.not_payable",
      providerPaymentId: testPaymentId(attempt.id),
      amountMinor: PLAN_PRICE,
    });
    expect(await attemptRow(attempt)).toMatchObject({ settlementResult: "order.not_payable" });
    const replay = await apply(attempt, paid(attempt), new Date(SYNC_AT.getTime() + MINUTE_MS));
    expect(replay).toMatchObject({ action: "ignore", openedIncidents: [] });
    expect(await auditCount(attempt.orderId, "payment_rejected")).toBe(1);
  });

  it("الدفعة نفسها مربوطة بمحاولة أخرى: حادثة payment_already_used بلا تسوية", async () => {
    const first = await pendingAttempt();
    await apply(first, paid(first));
    const second = await pendingAttempt();
    const reused = sessionSnapshot(second, [
      paymentSnapshot(second, "paid", { paymentId: testPaymentId(first.id) }),
    ]);
    const result = await apply(second, reused);
    expect(result).toMatchObject({
      status: "pending",
      settlement: null,
      openedIncidents: ["payment_already_used"],
    });
    expect((await orderRow(second)).status).toBe("pending_payment");
    expect(await db.membership.count()).toBe(1);
  });

  it("دفعتان مدفوعتان على جلسة واحدة: الأولى تسوّي والثانية حادثة order_already_paid", async () => {
    const attempt = await pendingAttempt();
    const second = paymentSnapshot(attempt, "paid", { paymentId: testPaymentId(attempt.id, 2) });
    const result = await apply(
      attempt,
      sessionSnapshot(attempt, [paymentSnapshot(attempt, "paid"), second]),
    );
    expect(result).toMatchObject({ settlement: "paid", openedIncidents: ["order_already_paid"] });
    expect(await db.membership.count()).toBe(1);
  });

  it("مراجع لا تطابق محاولتنا: حادثة unknown_reference ولا يُطبَّق من اللقطة شيء", async () => {
    const attempt = await pendingAttempt();
    const foreign = sessionSnapshot(attempt, [paymentSnapshot(attempt, "paid")], {
      attemptId: "0193a000-0000-7000-8000-00000000beef",
      rawStatus: "paid",
    });
    const result = await apply(attempt, foreign);
    expect(result).toMatchObject({
      action: "incident",
      status: "pending",
      settlement: null,
      openedIncidents: ["unknown_reference"],
    });
    expect(await attemptRow(attempt)).toMatchObject({ providerStatus: "open", checkCount: 1 });
    expect((await orderRow(attempt)).status).toBe("pending_payment");
  });

  it("محاولة غير موجودة: not_found", async () => {
    const attempt = await pendingAttempt();
    const missing = { ...attempt, id: "0193a000-0000-7000-8000-00000000dead" };
    const input = {
      attemptId: missing.id,
      snapshot: paid(missing),
      now: SYNC_AT,
      stuckAlertAfterMs: TEST_STUCK_AFTER_MS,
    };
    const result = failure(await applyProviderSnapshot(db, input));
    expect(result).toMatchObject({ code: "not_found", reason: "payment_attempt.not_found" });
  });
});
