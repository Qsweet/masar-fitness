import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "./index";
import {
  createAddon,
  createAssessedService,
  createPlan,
  createPromotion,
  createTestClub,
  ensureCustomer,
  expireRawOrder,
  insertRawMembership,
  insertRawOrder,
  markRawPaid,
  randomFingerprint,
  TEST_NOW,
  TEST_PHONE,
  type RawOrder,
  type TestProduct,
} from "./test-support/commerce-fixtures";
import { resetCommerceTables } from "./test-support/reset-database";

const url = process.env.DATABASE_URL;
if (url === undefined || url === "") {
  throw new Error(
    "اختبارات التكامل تحتاج DATABASE_URL لقاعدة اختبار مُرحَّلة (انظر docs/TESTING.md)",
  );
}

const PLAN_MONTHS = 3;
const BONUS_MONTHS = 1;
const DISCOUNT_MINOR = 1_000;
/** 21:00 بتوقيت الرياض يوم 15 يونيو؛ التاريخ يُكتب نصًا كما ستكتبه طبقة القاعدة. */
const PAID_AT = new Date("2026-06-15T18:00:00Z");
const STARTS_ON = "2026-06-15";
const ENDS_ON = "2026-10-15";
const OTHER_PHONE = "+966598765432";

let db: Db;
let clubId: string;
let plan: TestProduct;
let addon: TestProduct;

beforeAll(async () => {
  db = createDb(url);
  await resetCommerceTables(db);
  clubId = await createTestClub(db);
  plan = await createPlan(db, clubId, {
    priceMinor: 90_000,
    durationMonths: PLAN_MONTHS,
    bonusMonths: BONUS_MONTHS,
  });
  addon = await createAddon(db, clubId, plan.productId, { priceMinor: 5_000 });
});

afterAll(async () => {
  await resetCommerceTables(db);
  await db.$disconnect();
});

function newOrder(): Promise<RawOrder> {
  return insertRawOrder(db, { clubId, lines: [{ product: plan }, { product: addon }] });
}

function orderWithDiscount(promotionId: string, phone = TEST_PHONE): Promise<RawOrder> {
  return insertRawOrder(db, {
    clubId,
    phone,
    lines: [{ product: plan, discountMinor: DISCOUNT_MINOR }],
    discounts: [{ promotionId, amountMinor: DISCOUNT_MINOR }],
  });
}

async function paidOrder(): Promise<RawOrder> {
  const order = await newOrder();
  await markRawPaid(db, order.orderId, { paidAt: PAID_AT });
  return order;
}

function updateOrder(orderId: string, assignment: string): Promise<number> {
  return db.$executeRawUnsafe(`UPDATE orders SET ${assignment} WHERE id = $1::uuid`, orderId);
}

/** تسوية كاملة الأعمدة بمبلغ وعملة يحددهما الاختبار. */
function settlement(amount: string, currency: string): string {
  const head = "status = 'paid', paid_at = now(), paid_provider = 'test_pay'";
  return `${head}, paid_provider_payment_id = 'p', paid_amount_minor = ${amount}, paid_currency = ${currency}`;
}

describe("اللقطة للإلحاق فقط", () => {
  it("سطور الطلب وخصوماته لا تُعدَّل ولا تُحذف", async () => {
    const promotionId = await createPromotion(db, clubId);
    const { orderId } = await orderWithDiscount(promotionId);
    for (const table of ["order_items", "order_discounts"]) {
      const update = db.$executeRawUnsafe(
        `UPDATE ${table} SET name_ar = 'x' WHERE order_id = $1::uuid`,
        orderId,
      );
      await expect(update).rejects.toThrow("order_snapshot_immutable");
      const remove = db.$executeRawUnsafe(
        `DELETE FROM ${table} WHERE order_id = $1::uuid`,
        orderId,
      );
      await expect(remove).rejects.toThrow("order_snapshot_immutable");
    }
  });

  it.each([
    ["الإجمالي", "total_minor = total_minor - 1, subtotal_minor = subtotal_minor - 1"],
    ["اسم العميل", "customer_name = 'اسم آخر'"],
    ["المهلة", "expires_at = expires_at + interval '1 day'"],
  ])("تعديل %s في رأس الطلب مرفوض", async (_name, assignment) => {
    const { orderId } = await newOrder();
    await expect(updateOrder(orderId, assignment)).rejects.toThrow("order_snapshot_immutable");
  });

  it("حذف الطلب مرفوض", async () => {
    const { orderId } = await newOrder();
    const remove = db.$executeRaw`DELETE FROM orders WHERE id = ${orderId}::uuid`;
    await expect(remove).rejects.toThrow("order_delete_forbidden");
  });

  it("سجل التدقيق لا يُعدَّل ولا يُحذف", async () => {
    const id = randomUUID();
    await db.$executeRaw`
      INSERT INTO audit_logs (id, club_id, entity_type, entity_id, action, actor, created_at)
      VALUES (${id}::uuid, ${clubId}::uuid, 'order', ${randomUUID()}::uuid, 'created', 'system', ${TEST_NOW})`;
    const update = db.$executeRaw`UPDATE audit_logs SET action = 'x' WHERE id = ${id}::uuid`;
    await expect(update).rejects.toThrow("audit_log_append_only");
    const remove = db.$executeRaw`DELETE FROM audit_logs WHERE id = ${id}::uuid`;
    await expect(remove).rejects.toThrow("audit_log_append_only");
  });
});

describe("الثوابت الخشنة لحالة الطلب", () => {
  it("الطلب المنتهي لا يُدفع (expired → paid)", async () => {
    const { orderId } = await newOrder();
    await expireRawOrder(db, orderId);
    await expect(markRawPaid(db, orderId, { paidAt: PAID_AT })).rejects.toThrow(
      "order_status_final",
    );
  });

  it("لا عودة إلى pending_payment بعد الدفع", async () => {
    const { orderId } = await paidOrder();
    const back = updateOrder(orderId, "status = 'pending_payment'");
    await expect(back).rejects.toThrow("order_status_no_return");
  });

  it("الطلب المدفوع لا يُكتب منتهيًا (paid → expired)", async () => {
    const { orderId } = await paidOrder();
    const expire = updateOrder(orderId, "status = 'expired', expired_at = expires_at");
    await expect(expire).rejects.toThrow("orders_paid_state");
  });

  it("أعمدة التسوية لا تتغير بعد كتابتها", async () => {
    const { orderId } = await paidOrder();
    const change = updateOrder(orderId, "paid_provider_payment_id = 'another'");
    await expect(change).rejects.toThrow("order_payment_immutable");
  });

  it.each([
    ["تسوية جزئية", "status = 'paid', paid_at = now()", "orders_payment_complete"],
    ["مبلغ ينقص هللة", settlement("total_minor - 1", "currency"), "orders_payment_matches"],
    ["عملة أخرى", settlement("total_minor", "'USD'"), "orders_payment_matches"],
  ])("%s مرفوضة", async (_name, assignment, constraint) => {
    const { orderId } = await newOrder();
    await expect(updateOrder(orderId, assignment)).rejects.toThrow(constraint);
  });

  it("دفعة المزوّد الواحدة لا تسوّي طلبين", async () => {
    const first = await newOrder();
    const second = await newOrder();
    await markRawPaid(db, first.orderId, { paidAt: PAID_AT, paymentId: "same-payment" });
    const reuse = markRawPaid(db, second.orderId, { paidAt: PAID_AT, paymentId: "same-payment" });
    await expect(reuse).rejects.toThrow("orders_paid_provider_paid_provider_payment_id_key");
  });
});

describe("الاشتراك لطلب مدفوع فقط، ومرة واحدة", () => {
  const terms = { paidMonths: PLAN_MONTHS, bonusMonths: BONUS_MONTHS, orderPaidAt: PAID_AT };
  const active = { status: "active" as const, startsOn: STARTS_ON, endsOn: ENDS_ON };

  it("ينشأ لطلب مدفوع بمدة تطابق الحساب، ولا يتكرر", async () => {
    const order = await paidOrder();
    await insertRawMembership(db, { clubId, order, ...terms, ...active });
    const again = insertRawMembership(db, { clubId, order, ...terms });
    await expect(again).rejects.toThrow("memberships_order_id_key");
  });

  it("لطلب غير مدفوع مرفوض", async () => {
    const order = await newOrder();
    const attempt = insertRawMembership(db, { clubId, order, ...terms });
    await expect(attempt).rejects.toThrow("memberships_order_id_order_paid_at_fkey");
  });

  it("لسطر إضافة مرفوض", async () => {
    const order = await paidOrder();
    const attempt = insertRawMembership(db, { clubId, order, ...terms, itemIndex: 1 });
    await expect(attempt).rejects.toThrow(
      /membership_snapshot_mismatch|memberships_order_item_id_order_id_item_kind_fkey/,
    );
  });

  it("بأشهر تخالف السطر مرفوض", async () => {
    const order = await paidOrder();
    const attempt = insertRawMembership(db, {
      clubId,
      order,
      ...terms,
      paidMonths: PLAN_MONTHS + 1,
    });
    await expect(attempt).rejects.toThrow("membership_snapshot_mismatch");
  });

  it("بتاريخ انتهاء يخالف الحساب مرفوض", async () => {
    const order = await paidOrder();
    const attempt = insertRawMembership(db, {
      clubId,
      order,
      ...terms,
      ...active,
      endsOn: "2026-10-16",
    });
    await expect(attempt).rejects.toThrow("memberships_period_length");
  });

  it("الفترة لا تُمدَّد، والملغى نهائي", async () => {
    const order = await paidOrder();
    const id = await insertRawMembership(db, { clubId, order, ...terms, ...active });
    const extend = db.$executeRaw`
      UPDATE memberships SET ends_on = ends_on + 1, starts_on = starts_on + 1 WHERE id = ${id}::uuid`;
    await expect(extend).rejects.toThrow("membership_terms_immutable");
    await db.$executeRaw`
      UPDATE memberships SET status = 'cancelled', cancelled_at = ${PAID_AT} WHERE id = ${id}::uuid`;
    const revive = db.$executeRaw`
      UPDATE memberships SET status = 'active', cancelled_at = NULL WHERE id = ${id}::uuid`;
    await expect(revive).rejects.toThrow("membership_status_final");
  });
});

describe("حد استخدام العرض يُفرض في القاعدة", () => {
  it("الحد الكلي لا يُتجاوز بإدراج خام، ويتحرر بإنهاء الطلب", async () => {
    const promotionId = await createPromotion(db, clubId, { maxRedemptions: 1 });
    const first = await orderWithDiscount(promotionId);
    const second = orderWithDiscount(promotionId, OTHER_PHONE);
    await expect(second).rejects.toThrow("promotion_redemption_limit");
    await expireRawOrder(db, first.orderId);
    await expect(orderWithDiscount(promotionId, OTHER_PHONE)).resolves.toBeDefined();
  });

  it("حد العميل الواحد لا يمنع عميلًا آخر", async () => {
    const promotionId = await createPromotion(db, clubId, { maxRedemptionsPerCustomer: 1 });
    await orderWithDiscount(promotionId);
    await expect(orderWithDiscount(promotionId)).rejects.toThrow("promotion_customer_limit");
    await expect(orderWithDiscount(promotionId, OTHER_PHONE)).resolves.toBeDefined();
  });
});

describe("الاسترداد", () => {
  function insertRefund(orderId: string, amountMinor: number): Promise<number> {
    return db.$executeRaw`
      INSERT INTO refunds (id, club_id, order_id, amount_minor, reason, requested_at)
      VALUES (${randomUUID()}::uuid, ${clubId}::uuid, ${orderId}::uuid, ${amountMinor}, 'اختبار', ${TEST_NOW})`;
  }

  it("لطلب غير مدفوع مرفوض", async () => {
    const { orderId } = await newOrder();
    await expect(insertRefund(orderId, 1)).rejects.toThrow("refund_requires_paid_order");
  });

  it("مجموع يتجاوز إجمالي الطلب مرفوض", async () => {
    const order = await paidOrder();
    await expect(insertRefund(order.orderId, order.totals.totalMinor + 1)).rejects.toThrow(
      "refund_exceeds_order_total",
    );
    await insertRefund(order.orderId, order.totals.totalMinor);
    await expect(insertRefund(order.orderId, 1)).rejects.toThrow("refund_exceeds_order_total");
  });
});

describe("طلب التقييم", () => {
  async function insertAssessment(productId: string): Promise<number> {
    const customerId = await ensureCustomer(db, clubId, OTHER_PHONE);
    return db.$executeRaw`
      INSERT INTO assessment_requests (id, club_id, customer_id, product_id, customer_name,
        customer_phone_e164, locale, idempotency_key, request_fingerprint, created_at)
      VALUES (${randomUUID()}::uuid, ${clubId}::uuid, ${customerId}::uuid, ${productId}::uuid,
        'عميل اختبار', ${OTHER_PHONE}, 'ar', ${randomUUID()}::uuid, ${randomFingerprint()}, ${TEST_NOW})`;
  }

  it("يُقبل لخدمة بتقييم ويُرفض لمنتج اشتراك", async () => {
    const service = await createAssessedService(db, clubId, { priceMinor: 1_000 });
    await expect(insertAssessment(service.productId)).resolves.toBe(1);
    await expect(insertAssessment(plan.productId)).rejects.toThrow(
      "assessment_requests_product_id_product_kind_fkey",
    );
  });
});
