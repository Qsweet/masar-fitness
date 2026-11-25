import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDb, createOrder, expireDueOrders, markOrderPaid, type Db } from "./index";
import {
  createPlan,
  createPromotion,
  createTestClub,
  TEST_NOW,
  TEST_PAYMENT_WINDOW_MINUTES,
  type TestProduct,
} from "./test-support/commerce-fixtures";
import {
  couponCode,
  createDbClients,
  disconnectAll,
  orderInput,
  testBuyer,
  testDatabaseUrl,
  testPhone,
  unwrap,
} from "./test-support/commerce-orders";
import { resetCommerceTables } from "./test-support/reset-database";

const PLAN_PRICE = 90_000;
const DISCOUNTED = 81_000;
const CLIENTS = 20;
const RACE_ROUNDS = 100;
const MINUTE_MS = 60_000;
const ONCE = couponCode("RACE1");
/** بعد المهلة بدقيقة: الإنهاء والدفع كلاهما ممكن، والفائز من يأخذ قفل الصف أولًا. */
const AFTER_DEADLINE = new Date(TEST_NOW.getTime() + (TEST_PAYMENT_WINDOW_MINUTES + 1) * MINUTE_MS);

let db: Db;
let clients: Db[];
let plan: TestProduct;

beforeAll(async () => {
  db = createDb(testDatabaseUrl());
  clients = createDbClients(CLIENTS);
  await resetCommerceTables(db);
  const clubId = await createTestClub(db);
  plan = await createPlan(db, clubId, { priceMinor: PLAN_PRICE, durationMonths: 1 });
  await createPromotion(db, clubId, { code: ONCE, maxRedemptions: 1 });
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

/** دفعة متحقق منها بمبلغ الباقة كاملًا. */
function fullPayment(providerPaymentId: string) {
  return { provider: "test_pay", providerPaymentId, amountMinor: PLAN_PRICE, currency: "SAR" };
}

function pick(index: number): Db {
  const client = clients[index % clients.length];
  if (client === undefined) {
    throw new Error("لا عملاء قاعدة");
  }
  return client;
}

describe("سباقات الإنشاء", () => {
  it("عشرون نداءً متزامنًا بالمفتاح نفسه: طلب واحد", async () => {
    const input = orderInput(plan.slug, PLAN_PRICE);
    const results = await Promise.all(
      clients.map((client) => createOrder(client, input).then(unwrap)),
    );
    expect(new Set(results.map((result) => result.orderId)).size).toBe(1);
    expect(results.filter((result) => !result.replayed)).toHaveLength(1);
    expect(await db.order.count()).toBe(1);
  });

  it("المفتاح نفسه بجوال آخر مع كوبون حده 1: idempotency_key_reused لا exhausted", async () => {
    const input = orderInput(plan.slug, DISCOUNTED, { couponCode: ONCE });
    const other = { ...input, buyer: testBuyer(testPhone(31)) };
    const results = await Promise.all([createOrder(pick(0), input), createOrder(pick(1), other)]);
    const reasons = results.map((result) => (result.ok ? "ok" : result.error.reason)).sort();
    expect(reasons).toEqual(["ok", "order.idempotency_key_reused"]);
    expect(await db.orderDiscount.count()).toBe(1);
  });

  it("عشرة عملاء متزامنون على كوبون حده 1: طلب واحد بالخصم", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        createOrder(
          pick(index),
          orderInput(plan.slug, DISCOUNTED, {
            couponCode: ONCE,
            buyer: testBuyer(testPhone(100 + index)),
          }),
        ),
      ),
    );
    const losers = results.flatMap((result) => (result.ok ? [] : [result.error]));
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(new Set(losers.map((error) => `${error.reason}/${String(error.field)}`))).toEqual(
      new Set(["promotion.exhausted/coupon"]),
    );
    expect(await db.orderDiscount.count()).toBe(1);
    expect(await db.customer.count()).toBe(1);
  });
});

describe("سباقات الدفع", () => {
  it("عشرون تسجيلًا متزامنًا للدفعة نفسها: اشتراك واحد ونتيجة واحدة", async () => {
    const { orderId } = unwrap(await createOrder(db, orderInput(plan.slug, PLAN_PRICE)));
    const payment = fullPayment(randomUUID());
    const results = await Promise.all(
      clients.map((client) =>
        markOrderPaid(client, { orderId, payment, actor: "provider", now: TEST_NOW }).then(unwrap),
      ),
    );
    const outcomes = new Set(
      results.map((result) => `${result.status}/${String(result.membershipId)}`),
    );
    expect(outcomes.size).toBe(1);
    expect(results.filter((result) => !result.replayed)).toHaveLength(1);
    expect(await db.membership.count()).toBe(1);
  });

  it("الإنهاء يسابق الدفع مئة مرة: منتهٍ بلا اشتراك أو مدفوع باشتراك واحد", async () => {
    for (let round = 0; round < RACE_ROUNDS; round += 1) {
      const input = orderInput(plan.slug, PLAN_PRICE, {
        buyer: testBuyer(testPhone(1000 + round)),
      });
      const { orderId } = unwrap(await createOrder(db, input));
      const payment = fullPayment(`race-${String(round)}`);
      const [paid] = await Promise.all([
        markOrderPaid(pick(round), { orderId, payment, actor: "provider", now: AFTER_DEADLINE }),
        expireDueOrders(pick(round + 1), { now: AFTER_DEADLINE, limit: 10 }),
      ]);
      const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
      const memberships = await db.membership.count({ where: { orderId } });
      if (paid.ok) {
        expect([order.status, memberships]).toEqual(["fulfilled", 1]);
      } else {
        expect([paid.error.reason, order.status, memberships]).toEqual([
          "order.not_payable",
          "expired",
          0,
        ]);
      }
    }
  });

  it("ترتيب حتمي: الإنهاء يتخطى صفًا مقفولًا بلا انتظار، ثم الدفع بعد التحرير ينجح", async () => {
    const { orderId } = unwrap(await createOrder(db, orderInput(plan.slug, PLAN_PRICE)));
    const [holder, expirer] = [pick(0), pick(1)];
    const skipped = await holder.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`;
      return expireDueOrders(expirer, { now: AFTER_DEADLINE, limit: 10 });
    });
    expect(skipped).toBe(0);
    const pending = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(pending).toMatchObject({ status: "pending_payment", expiredAt: null });
    const payment = fullPayment(randomUUID());
    const paid = unwrap(
      await markOrderPaid(db, { orderId, payment, actor: "provider", now: AFTER_DEADLINE }),
    );
    expect(paid).toMatchObject({ status: "fulfilled", replayed: false });
    expect(await db.membership.count({ where: { orderId } })).toBe(1);
  });

  it("ترتيب حتمي: الإنهاء أولًا ثم الدفع ⇒ not_payable وسطر payment_rejected بلا اشتراك", async () => {
    const { orderId } = unwrap(await createOrder(db, orderInput(plan.slug, PLAN_PRICE)));
    expect(await expireDueOrders(db, { now: AFTER_DEADLINE, limit: 10 })).toBe(1);
    const payment = fullPayment(randomUUID());
    const late = await markOrderPaid(db, {
      orderId,
      payment,
      actor: "provider",
      now: AFTER_DEADLINE,
    });
    expect(late.ok ? undefined : late.error.reason).toBe("order.not_payable");
    const rejected = await db.auditLog.findMany({
      where: { entityId: orderId, action: "payment_rejected" },
    });
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.data).toMatchObject({
      providerPaymentId: payment.providerPaymentId,
      reason: "order.not_payable",
    });
    expect(await db.order.findUniqueOrThrow({ where: { id: orderId } })).toMatchObject({
      status: "expired",
      paidAt: null,
    });
    expect(await db.membership.count({ where: { orderId } })).toBe(0);
  });
});
