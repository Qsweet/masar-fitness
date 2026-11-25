import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDb, createOrder, findOrderByPublicToken, type Db } from "./index";
import {
  createAddon,
  createDigitalProgram,
  createPlan,
  createTestClub,
  expiryAfter,
  includedVat,
  TEST_NOW,
  TEST_PAYMENT_WINDOW_MINUTES,
  TEST_VAT_RATE_BPS,
  type TestProduct,
} from "./test-support/commerce-fixtures";
import {
  failure,
  orderInput,
  testBuyer,
  testDatabaseUrl,
  testPhone,
  unwrap,
} from "./test-support/commerce-orders";
import { resetCommerceTables } from "./test-support/reset-database";

const PLAN_PRICE = 90_000;
const ADDON_PRICE = 5_000;
const MINUTE_MS = 60_000;

let db: Db;
let clubId: string;
let plan: TestProduct;
let addon: TestProduct;

beforeAll(async () => {
  db = createDb(testDatabaseUrl());
  await resetCommerceTables(db);
  clubId = await createTestClub(db);
  plan = await createPlan(db, clubId, {
    priceMinor: PLAN_PRICE,
    durationMonths: 3,
    bonusMonths: 1,
    benefits: ["دخول الصالة", "خزانة"],
  });
  addon = await createAddon(db, clubId, plan.productId, { priceMinor: ADDON_PRICE });
});

beforeEach(async () => {
  await db.$executeRaw`TRUNCATE audit_logs, order_discounts, order_items, orders, customers CASCADE`;
});

afterAll(async () => {
  await resetCommerceTables(db);
  await db.$disconnect();
});

function customersWithPhone(phone: string): Promise<number> {
  return db.customer.count({ where: { phoneE164: phone } });
}

describe("createOrder يكتب اللقطة كما قررها المجال", () => {
  it("يحفظ المرجع والمهلة والسطور والمجاميع وسطر التدقيق", async () => {
    const total = PLAN_PRICE + ADDON_PRICE;
    const input = orderInput(plan.slug, total, { addonSlugs: [addon.slug] });
    const created = unwrap(await createOrder(db, input));
    expect(created).toMatchObject({ publicToken: input.publicToken, replayed: false });
    expect(created.reference).toMatch(/^MSR-\d{7}$/);
    const order = await db.order.findUniqueOrThrow({
      where: { id: created.orderId },
      include: { items: { orderBy: { position: "asc" } } },
    });
    expect(order).toMatchObject({
      status: "pending_payment",
      totalMinor: total,
      subtotalMinor: total,
      discountMinor: 0,
      vatRateBps: TEST_VAT_RATE_BPS,
      customerPhoneE164: input.buyer.mobile,
      expiresAt: expiryAfter(TEST_NOW, TEST_PAYMENT_WINDOW_MINUTES),
    });
    expect(order.items.map((item) => [item.kind, item.productSlug, item.vatMinor])).toEqual([
      ["membership", plan.slug, includedVat(PLAN_PRICE, TEST_VAT_RATE_BPS)],
      ["addon", addon.slug, includedVat(ADDON_PRICE, TEST_VAT_RATE_BPS)],
    ]);
    expect(order.items[0]).toMatchObject({
      durationMonths: 3,
      bonusMonths: 1,
      membershipStartRule: "on_payment",
      benefits: [
        { ar: "دخول الصالة", en: "دخول الصالة" },
        { ar: "خزانة", en: "خزانة" },
      ],
    });
    const audit = await db.auditLog.findMany({ where: { entityId: created.orderId } });
    expect(audit.map((row) => [row.action, row.toState, row.actor])).toEqual([
      ["order_created", "pending_payment", "customer"],
    ]);
    expect(JSON.stringify(audit[0]?.data)).not.toContain(input.buyer.mobile);
  });

  it("نسخة جديدة وأرشفة المنتج بعد الإنشاء لا تغيّران صفحة الطلب", async () => {
    const own = await createPlan(db, clubId, { priceMinor: PLAN_PRICE, durationMonths: 1 });
    const input = orderInput(own.slug, PLAN_PRICE);
    unwrap(await createOrder(db, input));
    const before = await findOrderByPublicToken(db, input.publicToken, TEST_NOW);
    await db.productVersion.update({
      where: { id: own.versionId },
      data: { validUntil: TEST_NOW },
    });
    await db.productVersion.create({
      data: {
        productId: own.productId,
        priceMinor: PLAN_PRICE * 2,
        durationMonths: 2,
        validFrom: TEST_NOW,
        benefits: { create: [{ labelAr: "جديدة", labelEn: "New" }] },
      },
    });
    await db.product.update({ where: { id: own.productId }, data: { status: "archived" } });
    const after = await findOrderByPublicToken(db, input.publicToken, TEST_NOW);
    expect(after).toEqual(before);
    expect(after?.items[0]).toMatchObject({
      paidMonths: 1,
      benefits: [{ ar: "ميزة", en: "ميزة" }],
    });
    expect(after?.total.amountMinor).toBe(PLAN_PRICE);
  });

  it("صفحة الطلب: الجوال مقنَّع والحالة الفعلية منتهية عند المهلة بالضبط", async () => {
    const input = orderInput(plan.slug, PLAN_PRICE);
    unwrap(await createOrder(db, input));
    const deadline = expiryAfter(TEST_NOW, TEST_PAYMENT_WINDOW_MINUTES);
    const early = await findOrderByPublicToken(
      db,
      input.publicToken,
      new Date(deadline.getTime() - 1),
    );
    const late = await findOrderByPublicToken(db, input.publicToken, deadline);
    expect(early?.maskedPhone).toBe("+966•••••••78");
    expect(early?.effectiveStatus).toBe("pending_payment");
    expect(late).toMatchObject({ status: "pending_payment", effectiveStatus: "expired" });
    expect(await findOrderByPublicToken(db, "x".repeat(43), TEST_NOW)).toBeUndefined();
  });
});

describe("createOrder: التكرار والسعر", () => {
  it("نداءان بالمفتاح نفسه يعطيان طلبًا واحدًا", async () => {
    const input = orderInput(plan.slug, PLAN_PRICE);
    const first = unwrap(await createOrder(db, input));
    const second = unwrap(await createOrder(db, { ...input, publicToken: "ignored" }));
    expect(second).toEqual({ ...first, replayed: true });
    expect(await db.order.count()).toBe(1);
  });

  it("المفتاح نفسه ببيانات مختلفة يرجع idempotency_key_reused بلا كتابة", async () => {
    const input = orderInput(plan.slug, PLAN_PRICE);
    unwrap(await createOrder(db, input));
    const reused = failure(await createOrder(db, { ...input, buyer: testBuyer(testPhone(7)) }));
    expect(reused).toMatchObject({ code: "conflict", reason: "order.idempotency_key_reused" });
    expect(await db.order.count()).toBe(1);
  });

  it("cart.price_changed يحمل الإجمالي الجديد ولا يكتب طلبًا ولا عميلًا", async () => {
    const phone = testPhone(11);
    const input = orderInput(plan.slug, PLAN_PRICE - 1, { buyer: testBuyer(phone) });
    const changed = failure(await createOrder(db, input));
    expect(changed).toMatchObject({ code: "conflict", reason: "cart.price_changed" });
    expect(changed.cause).toEqual({ totalMinor: PLAN_PRICE });
    expect(await db.order.count()).toBe(0);
    expect(await customersWithPhone(phone)).toBe(0);
  });

  it("منتج غير قابل للبيع أو إضافة غير مرتبطة: أخطاء السلة بلا كتابة", async () => {
    const missing = failure(await createOrder(db, orderInput("no-such-plan", PLAN_PRICE)));
    expect(missing).toMatchObject({ code: "not_found", reason: "cart.product_unavailable" });
    const asAddon = failure(
      await createOrder(db, orderInput(plan.slug, PLAN_PRICE, { addonSlugs: [plan.slug] })),
    );
    expect(asAddon.reason).toBe("cart.product_unavailable");
    const other = await createPlan(db, clubId, { priceMinor: PLAN_PRICE, durationMonths: 1 });
    const unlinked = failure(
      await createOrder(db, orderInput(other.slug, PLAN_PRICE, { addonSlugs: [addon.slug] })),
    );
    expect(unlinked).toMatchObject({ code: "validation", reason: "cart.addon_not_attachable" });
    expect(await db.customer.count()).toBe(0);
  });
});

describe("createOrder: السياسات غير المحسومة والحدود", () => {
  it("كل سياسة NULL تمنع الإنشاء، والبرنامج الرقمي لا يحتاج قاعدة البدء", async () => {
    const noWindow = await createTestClub(db, { orderPaymentWindowMinutes: null });
    const noRule = await createTestClub(db, { membershipStartRule: null });
    const planA = await createPlan(db, noWindow, { priceMinor: PLAN_PRICE, durationMonths: 1 });
    const planB = await createPlan(db, noRule, { priceMinor: PLAN_PRICE, durationMonths: 1 });
    const program = await createDigitalProgram(db, noRule, { priceMinor: ADDON_PRICE });
    const blockedA = failure(await createOrder(db, orderInput(planA.slug, PLAN_PRICE)));
    const blockedB = failure(await createOrder(db, orderInput(planB.slug, PLAN_PRICE)));
    expect(blockedA).toMatchObject({ reason: "policy.undecided.order_payment_window" });
    expect(blockedB).toMatchObject({ reason: "policy.undecided.membership_start_rule" });
    expect(await db.order.count()).toBe(0);
    expect(await db.customer.count()).toBe(0);
    unwrap(await createOrder(db, orderInput(program.slug, ADDON_PRICE)));
  });

  it("too_many_pending عند الحد، ويتحرر الحد بعد إنهاء الطلبات في الإنشاء", async () => {
    for (let index = 0; index < 3; index += 1) {
      unwrap(await createOrder(db, orderInput(plan.slug, PLAN_PRICE)));
    }
    const blocked = failure(await createOrder(db, orderInput(plan.slug, PLAN_PRICE)));
    expect(blocked).toMatchObject({ code: "conflict", reason: "order.too_many_pending" });
    const later = new Date(TEST_NOW.getTime() + (TEST_PAYMENT_WINDOW_MINUTES + 1) * MINUTE_MS);
    unwrap(await createOrder(db, orderInput(plan.slug, PLAN_PRICE, { now: later })));
    expect(await db.order.count({ where: { status: "expired" } })).toBe(3);
    const expiredAudit = await db.auditLog.count({ where: { action: "order_expired" } });
    expect(expiredAudit).toBe(3);
  });
});
