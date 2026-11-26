import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  cancelPendingOrder,
  createDb,
  createOrder,
  createPaymentAttempt,
  expireDueOrders,
  getOrderDetail,
  markOrderPaid,
  quoteCart,
  staffActor,
  type Db,
} from "./index";
import {
  createPlan,
  createPromotion,
  createTestClub,
  TEST_NOW,
  type TestProduct,
} from "./test-support/commerce-fixtures";
import {
  couponCode,
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
  openTestAttempt,
  sessionSnapshot,
  TEST_MIN_PAYMENT_MINUTES,
  TEST_PROVIDER,
} from "./test-support/payments-fixtures";
import { resetCommerceTables } from "./test-support/reset-database";
import { createTestStaff, type TestStaff } from "./test-support/staff-fixtures";

const PLAN_PRICE = 90_000;
const TEN_PERCENT_OFF = 81_000;
const MINUTE_MS = 60_000;
const AFTER_WINDOW = new Date(TEST_NOW.getTime() + 31 * MINUTE_MS);
const RACE_ROUNDS = 12;
const ONCE = couponCode("ONCE1");

let db: Db;
let other: Db;
let clubId: string;
let otherClubId: string;
let plan: TestProduct;
let staff: TestStaff;
let phoneIndex = 0;

beforeAll(async () => {
  db = createDb(testDatabaseUrl());
  [other] = createDbClients(1) as [Db];
  await resetCommerceTables(db);
  clubId = await createTestClub(db);
  otherClubId = await createTestClub(db);
  plan = await createPlan(db, clubId, { priceMinor: PLAN_PRICE, durationMonths: 1 });
  staff = await createTestStaff(db, clubId, { role: "sales" });
});

beforeEach(async () => {
  await db.$executeRaw`
    TRUNCATE audit_logs, memberships, order_discounts, order_items, orders, customers,
      promotions CASCADE`;
});

afterAll(async () => {
  await resetCommerceTables(db);
  await disconnectAll([other]);
  await db.$disconnect();
});

async function newOrder(overrides: Parameters<typeof orderInput>[2] = {}): Promise<string> {
  phoneIndex += 1;
  const input = orderInput(plan.slug, PLAN_PRICE, {
    buyer: testBuyer(testPhone(phoneIndex)),
    ...overrides,
  });
  return unwrap(await createOrder(db, input)).orderId;
}

function cancel(orderId: string, now = TEST_NOW, client = db, club = clubId) {
  return cancelPendingOrder(client, {
    orderId,
    clubId: club,
    reasonCode: "customer_request",
    actor: staffActor(staff.id),
    now,
  });
}

function pay(orderId: string, client = db) {
  const payment = {
    provider: TEST_PROVIDER,
    providerPaymentId: randomUUID(),
    amountMinor: PLAN_PRICE,
    currency: "SAR",
  };
  return markOrderPaid(client, { orderId, payment, actor: "provider", now: TEST_NOW });
}

function startAttempt(orderId: string, client = db) {
  return createPaymentAttempt(client, {
    orderId,
    provider: TEST_PROVIDER,
    providerMode: "test",
    minPaymentMinutes: TEST_MIN_PAYMENT_MINUTES,
    now: TEST_NOW,
  });
}

function orderRow(orderId: string) {
  return db.order.findUniqueOrThrow({ where: { id: orderId } });
}

function cancelAudits(orderId: string) {
  return db.auditLog.findMany({ where: { entityId: orderId, action: "order_cancelled" } });
}

async function liveAttempts(orderId: string): Promise<number> {
  const rows = await db.$queryRaw<{ total: number }[]>`
    SELECT count(*)::int AS total FROM payment_attempts a
    WHERE a.order_id = ${orderId}::uuid AND payment_attempt_is_live(a.status, a.settled_at)`;
  return rows[0]?.total ?? 0;
}

describe("cancelPendingOrder", () => {
  it("يلغي معلّقًا ويكتب سطر تدقيق باسم الموظف ورمز السبب", async () => {
    const orderId = await newOrder();
    const cancelled = unwrap(await cancel(orderId));
    expect(cancelled).toMatchObject({ orderId, replayed: false });
    expect(await orderRow(orderId)).toMatchObject({ status: "cancelled", cancelledAt: TEST_NOW });
    const audits = await cancelAudits(orderId);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      entityType: "order",
      fromState: "pending_payment",
      toState: "cancelled",
      actor: `staff:${staff.id}`,
      data: { reference: cancelled.reference, reason: "customer_request" },
    });
    const detail = await getOrderDetail(db, clubId, orderId, TEST_NOW);
    expect(detail?.cancelledAt).toEqual(TEST_NOW);
    expect(detail?.timeline.map((entry) => entry.action)).toEqual([
      "order_created",
      "order_cancelled",
    ]);
  });

  it("الإعادة على ملغى: النتيجة نفسها بلا سطر ثانٍ ولا تغيير وقت", async () => {
    const orderId = await newOrder();
    unwrap(await cancel(orderId));
    const again = unwrap(await cancel(orderId, new Date(TEST_NOW.getTime() + MINUTE_MS)));
    expect(again.replayed).toBe(true);
    expect(await cancelAudits(orderId)).toHaveLength(1);
    expect((await orderRow(orderId)).cancelledAt).toEqual(TEST_NOW);
  });

  it("المدفوع والمنتهي ومن بلغ مهلته لا تُلغى", async () => {
    const paid = await newOrder();
    unwrap(await pay(paid));
    expect(failure(await cancel(paid))).toMatchObject({ reason: "order.not_cancellable" });

    const expired = await newOrder();
    expect(await expireDueOrders(db, { now: AFTER_WINDOW, limit: 10 })).toBe(1);
    expect(failure(await cancel(expired, AFTER_WINDOW))).toMatchObject({
      reason: "order.not_cancellable",
    });

    const lapsed = await newOrder();
    expect(failure(await cancel(lapsed, AFTER_WINDOW))).toMatchObject({
      code: "conflict",
      reason: "order.not_cancellable",
    });
    expect((await orderRow(lapsed)).status).toBe("pending_payment");
    expect(await db.auditLog.count({ where: { action: "order_cancelled" } })).toBe(0);
  });

  it("طلب من نادٍ آخر أو غير موجود: not_found", async () => {
    const orderId = await newOrder();
    expect(failure(await cancel(orderId, TEST_NOW, db, otherClubId))).toMatchObject({
      code: "not_found",
      reason: "order.not_found",
    });
    expect(failure(await cancel(randomUUID()))).toMatchObject({ reason: "order.not_found" });
    expect((await orderRow(orderId)).status).toBe("pending_payment");
  });
});

describe("الإلغاء والمحاولة الحيّة", () => {
  it("الكود يرفض والمحاولة حيّة، ويقبل بعد نهايتها", async () => {
    const orderId = await newOrder();
    const attempt = await openTestAttempt(db, orderId);
    expect(failure(await cancel(orderId))).toMatchObject({
      reason: "order.cancel_blocked_by_live_attempt",
    });
    expect((await orderRow(orderId)).status).toBe("pending_payment");
    const closed = sessionSnapshot(attempt, [], { state: "closed", rawStatus: "expired" });
    await applyTestSnapshot(db, attempt, closed, TEST_NOW);
    expect(unwrap(await cancel(orderId)).replayed).toBe(false);
  });

  it("T11: UPDATE خام إلى cancelled مرفوض ما دامت المحاولة حيّة", async () => {
    const orderId = await newOrder();
    const attempt = await openTestAttempt(db, orderId);
    const raw = () => db.$executeRaw`
      UPDATE orders SET status = 'cancelled', cancelled_at = ${TEST_NOW} WHERE id = ${orderId}::uuid`;
    await expect(raw()).rejects.toThrow("order_cancel_blocked_by_live_attempt");
    const closed = sessionSnapshot(attempt, [], { state: "closed", rawStatus: "expired" });
    await applyTestSnapshot(db, attempt, closed, TEST_NOW);
    expect(await raw()).toBe(1);
  });

  it(`${String(RACE_ROUNDS)} جولة: إلغاء مع بدء محاولة، لا طلب ملغى ومعه محاولة حيّة أبدًا`, async () => {
    const winners = { cancel: 0, attempt: 0 };
    for (let round = 0; round < RACE_ROUNDS; round += 1) {
      const orderId = await newOrder();
      const [cancelled, started] = await Promise.all([
        cancel(orderId, TEST_NOW, round % 2 === 0 ? db : other),
        startAttempt(orderId, round % 2 === 0 ? other : db),
      ]);
      expect(cancelled.ok).not.toBe(started.ok);
      const { status } = await orderRow(orderId);
      expect(await liveAttempts(orderId)).toBe(status === "cancelled" ? 0 : 1);
      expect(status).toBe(cancelled.ok ? "cancelled" : "pending_payment");
      winners[cancelled.ok ? "cancel" : "attempt"] += 1;
    }
    expect(winners.cancel + winners.attempt).toBe(RACE_ROUNDS);
  }, 60_000);
});

describe("سباق الإلغاء مع التسوية", () => {
  it(`${String(RACE_ROUNDS)} جولة: واحد ينجح فقط، ولا اشتراك لطلب ملغى`, async () => {
    for (let round = 0; round < RACE_ROUNDS; round += 1) {
      const orderId = await newOrder();
      const [cancelled, paid] = await Promise.all([
        cancel(orderId, TEST_NOW, round % 2 === 0 ? db : other),
        pay(orderId, round % 2 === 0 ? other : db),
      ]);
      expect(cancelled.ok).not.toBe(paid.ok);
      const { status } = await orderRow(orderId);
      const memberships = await db.membership.count({ where: { orderId } });
      expect(status).toBe(cancelled.ok ? "cancelled" : "fulfilled");
      expect(memberships).toBe(cancelled.ok ? 0 : 1);
      const reason = cancelled.ok ? "order.not_payable" : "order.not_cancellable";
      expect(failure(cancelled.ok ? paid : cancelled)).toMatchObject({ reason });
    }
  }, 60_000);
});

describe("الإلغاء يحرر استخدام الكوبون", () => {
  it("كوبون بحد واحد: مستنفد والطلب معلّق، ومتاح بعد إلغائه", async () => {
    await createPromotion(db, clubId, { code: ONCE, maxRedemptions: 1 });
    const first = await newOrder({ couponCode: ONCE, quotedTotalMinor: TEN_PERCENT_OFF });
    const request = { planSlug: plan.slug, addonSlugs: [], couponCode: ONCE };
    const blocked = unwrap(await quoteCart(db, request, TEST_NOW));
    expect(blocked.couponError?.reason).toBe("promotion.exhausted");

    unwrap(await cancel(first));
    const freed = unwrap(await quoteCart(db, request, TEST_NOW));
    expect(freed.couponError).toBeNull();
    expect(freed.total.amountMinor).toBe(TEN_PERCENT_OFF);
    const second = await newOrder({ couponCode: ONCE, quotedTotalMinor: TEN_PERCENT_OFF });
    expect((await orderRow(second)).totalMinor).toBe(TEN_PERCENT_OFF);
  });
});
