import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDb, createOrder, quoteCart, type Db } from "./index";
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
  failure,
  orderInput,
  testBuyer,
  testDatabaseUrl,
  testPhone,
  unwrap,
} from "./test-support/commerce-orders";
import { resetCommerceTables } from "./test-support/reset-database";

const PLAN_PRICE = 90_000;
/** 10% من 90,000 */
const TEN_PERCENT_OFF = 81_000;
const FIXED_OFF = 2_000;
const MINUTE_MS = 60_000;
const ONCE = couponCode("ONCE1");

let db: Db;
let clubId: string;
let plan: TestProduct;

beforeAll(async () => {
  db = createDb(testDatabaseUrl());
  await resetCommerceTables(db);
  clubId = await createTestClub(db);
  plan = await createPlan(db, clubId, { priceMinor: PLAN_PRICE, durationMonths: 3 });
  await createPromotion(db, clubId, { code: ONCE, maxRedemptions: 1 });
  await createPromotion(db, clubId, {
    code: "ENDED",
    endsAt: new Date(TEST_NOW.getTime() - MINUTE_MS),
    startsAt: new Date(TEST_NOW.getTime() - 2 * MINUTE_MS),
  });
});

beforeEach(async () => {
  await db.$executeRaw`TRUNCATE audit_logs, order_discounts, order_items, orders, customers CASCADE`;
});

afterAll(async () => {
  await resetCommerceTables(db);
  await db.$disconnect();
});

describe("quoteCart", () => {
  it("يسعّر بمحرك الطلب نفسه، والإجمالي يطابق ما يكتبه الإنشاء", async () => {
    const quote = unwrap(
      await quoteCart(db, { planSlug: plan.slug, addonSlugs: [], couponCode: ONCE }, TEST_NOW),
    );
    expect(quote).toMatchObject({
      blockers: [],
      couponError: null,
      membershipStartRule: "on_payment",
    });
    expect(quote.total.amountMinor).toBe(TEN_PERCENT_OFF);
    const input = orderInput(plan.slug, quote.total.amountMinor, { couponCode: ONCE });
    const created = unwrap(await createOrder(db, input));
    const discounts = await db.orderDiscount.findMany({ where: { orderId: created.orderId } });
    expect(discounts.map((row) => [row.source, row.code, row.amountMinor])).toEqual([
      ["coupon", "ONCE1", PLAN_PRICE - TEN_PERCENT_OFF],
    ]);
  });

  it("السياسة غير المحسومة تُرجَع بيانات لا خطأ، والمنتج المجهول not_found", async () => {
    const undecided = await createTestClub(db, { membershipStartRule: null });
    const other = await createPlan(db, undecided, { priceMinor: PLAN_PRICE, durationMonths: 1 });
    const request = { planSlug: other.slug, addonSlugs: [], couponCode: null };
    const quote = unwrap(await quoteCart(db, request, TEST_NOW));
    expect(quote).toMatchObject({ blockers: ["membership_start_rule"], membershipStartRule: null });
    const missing = failure(await quoteCart(db, { ...request, planSlug: "missing" }, TEST_NOW));
    expect(missing).toMatchObject({ code: "not_found", reason: "cart.product_unavailable" });
  });

  it("العرض المقيَّد بجمهور لا يُطبَّق قبل الجوال ويُطبَّق بالمكانة الحقيقية عند الإنشاء", async () => {
    const club = await createTestClub(db);
    const own = await createPlan(db, club, { priceMinor: PLAN_PRICE, durationMonths: 1 });
    await createPromotion(db, club, { audience: "new_customer" });
    const request = { planSlug: own.slug, addonSlugs: [], couponCode: null };
    const quote = unwrap(await quoteCart(db, request, TEST_NOW));
    expect(quote.total.amountMinor).toBe(PLAN_PRICE);
    const stale = failure(await createOrder(db, orderInput(own.slug, PLAN_PRICE)));
    expect(stale.cause).toEqual({ totalMinor: TEN_PERCENT_OFF });
    unwrap(await createOrder(db, orderInput(own.slug, TEN_PERCENT_OFF)));
  });
});

describe("createOrder: الكوبونات", () => {
  it("رمز مجهول: not_found على حقل الكوبون، ولا يبقى عميل", async () => {
    const phone = testPhone(21);
    const input = orderInput(plan.slug, PLAN_PRICE, {
      couponCode: couponCode("NOPE99"),
      buyer: testBuyer(phone),
    });
    const unknown = failure(await createOrder(db, input));
    expect(unknown).toMatchObject({ code: "not_found", reason: "coupon.unknown", field: "coupon" });
    expect(await db.customer.count({ where: { phoneE164: phone } })).toBe(0);
  });

  it("فشل التسعير (كوبون منتهٍ) لا يترك عميلًا ولا طلبًا", async () => {
    const phone = testPhone(22);
    const input = orderInput(plan.slug, PLAN_PRICE, {
      couponCode: couponCode("ENDED"),
      buyer: testBuyer(phone),
    });
    const ended = failure(await createOrder(db, input));
    expect(ended).toMatchObject({ code: "validation", reason: "promotion.ended", field: "coupon" });
    expect(await db.customer.count({ where: { phoneE164: phone } })).toBe(0);
    expect(await db.order.count()).toBe(0);
  });

  it("الطلب الفائتة مهلته يبقى حاجزًا للكوبون حتى يُنهى في الإنشاء", async () => {
    unwrap(await createOrder(db, orderInput(plan.slug, TEN_PERCENT_OFF, { couponCode: ONCE })));
    const later = new Date(TEST_NOW.getTime() + (TEST_PAYMENT_WINDOW_MINUTES + 1) * MINUTE_MS);
    const request = { planSlug: plan.slug, addonSlugs: [], couponCode: ONCE };
    const quote = unwrap(await quoteCart(db, request, later));
    expect(quote.couponError?.reason).toBe("promotion.exhausted");
    const input = orderInput(plan.slug, TEN_PERCENT_OFF, {
      couponCode: ONCE,
      buyer: testBuyer(testPhone(23)),
      now: later,
    });
    unwrap(await createOrder(db, input));
    expect(await db.order.count({ where: { status: "expired" } })).toBe(1);
    expect(await db.orderDiscount.count()).toBe(2);
  });

  it("خصم ثابت تلقائي يُكتب لقطةً بقاعدته", async () => {
    const club = await createTestClub(db);
    const own = await createPlan(db, club, { priceMinor: PLAN_PRICE, durationMonths: 1 });
    await createPromotion(db, club, {
      discountKind: "fixed_amount",
      percentBps: null,
      amountMinor: FIXED_OFF,
      currency: "SAR",
    });
    const created = unwrap(await createOrder(db, orderInput(own.slug, PLAN_PRICE - FIXED_OFF)));
    const [discount] = await db.orderDiscount.findMany({ where: { orderId: created.orderId } });
    expect(discount).toMatchObject({
      source: "automatic",
      code: null,
      discountKind: "fixed_amount",
      fixedAmountMinor: FIXED_OFF,
      percentBps: null,
      sequence: 1,
      amountMinor: FIXED_OFF,
    });
  });
});
