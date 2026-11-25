import { randomUUID } from "node:crypto";
import { DomainError } from "@masar/domain";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { constraintName, createDb, isUniqueViolation, mapCommerceDbError, type Db } from "./index";
import {
  createPlan,
  createPromotion,
  createTestClub,
  ensureCustomer,
  insertRawOrder,
  markRawPaid,
  randomPublicToken,
  TEST_NOW,
  TEST_PHONE,
  type TestProduct,
} from "./test-support/commerce-fixtures";
import { testDatabaseUrl } from "./test-support/commerce-orders";
import { resetCommerceTables } from "./test-support/reset-database";

let db: Db;
let clubId: string;
let plan: TestProduct;

beforeAll(async () => {
  db = createDb(testDatabaseUrl());
  await resetCommerceTables(db);
  clubId = await createTestClub(db);
  plan = await createPlan(db, clubId, { priceMinor: 50_000, durationMonths: 1 });
});

afterAll(async () => {
  await resetCommerceTables(db);
  await db.$disconnect();
});

/** يرجع الخطأ الذي رمته العملية، ويفشل الاختبار إن نجحت. */
async function caught(work: () => Promise<unknown>): Promise<unknown> {
  try {
    await work();
  } catch (error) {
    return error;
  }
  throw new Error("توقعنا رفض القاعدة، فنجحت الجملة");
}

/** نسخة من طلب قائم بالمفتاح نفسه: تصطدم بقيد فرادة المفتاح. */
function duplicateKey(orderId: string) {
  return db.$executeRaw`
    INSERT INTO orders (id, club_id, public_token, idempotency_key, request_fingerprint, customer_id,
      customer_name, customer_phone_e164, locale, currency, vat_rate_bps, subtotal_minor,
      discount_minor, total_minor, vat_minor, created_at, expires_at)
    SELECT ${randomUUID()}::uuid, club_id, ${randomPublicToken()}, idempotency_key, request_fingerprint,
      customer_id, customer_name, customer_phone_e164, locale, currency, vat_rate_bps, subtotal_minor,
      discount_minor, total_minor, vat_minor, created_at, expires_at
    FROM orders WHERE id = ${orderId}::uuid`;
}

describe("أسماء القيود من خطأ محوّل Prisma 7 الحقيقي", () => {
  it("فرادة من استعلام Prisma (P2002) ومن SQL خام (P2010)", async () => {
    await ensureCustomer(db, clubId, TEST_PHONE);
    const viaModel = await caught(() =>
      db.customer.create({ data: { clubId, phoneE164: TEST_PHONE } }),
    );
    const viaRaw = await caught(() => ensureCustomerStrict(clubId));
    for (const error of [viaModel, viaRaw]) {
      expect(constraintName(error)).toBe("customers_club_id_phone_e164_key");
      expect(isUniqueViolation(error, "customers_club_id_phone_e164_key")).toBe(true);
      expect(isUniqueViolation(error, "orders_idempotency_key_key")).toBe(false);
      expect(mapCommerceDbError(error)).toBeUndefined();
    }
  });

  it("CHECK والمفتاح الأجنبي بأسمائهما، وليسا خرق فرادة", async () => {
    const check = await caught(
      () => db.$executeRaw`
        INSERT INTO customers (id, club_id, phone_e164) VALUES (${randomUUID()}::uuid, ${clubId}::uuid, '0500')`,
    );
    expect(constraintName(check)).toBe("customers_phone_shape");
    expect(isUniqueViolation(check, "customers_phone_shape")).toBe(false);
    const foreign = await caught(() => ensureCustomer(db, randomUUID(), TEST_PHONE));
    expect(constraintName(foreign)).toBe("customers_club_id_fkey");
  });

  it("مفتاح الطلب المكرر يُحوَّل إلى إعادة القراءة، والدفعة المكررة إلى already_used", async () => {
    const first = await insertRawOrder(db, { clubId, lines: [{ product: plan }] });
    const keyError = await caught(() => duplicateKey(first.orderId));
    expect(isUniqueViolation(keyError, "orders_idempotency_key_key")).toBe(true);
    expect(mapCommerceDbError(keyError)?.reason).toBe("order.idempotency_retry");
    const second = await insertRawOrder(db, { clubId, lines: [{ product: plan }] });
    await markRawPaid(db, first.orderId, { paidAt: TEST_NOW, paymentId: "dup-1" });
    const used = await caught(() =>
      markRawPaid(db, second.orderId, { paidAt: TEST_NOW, paymentId: "dup-1" }),
    );
    expect(mapCommerceDbError(used)).toMatchObject({
      code: "conflict",
      reason: "payment.already_used",
    });
  });

  it("رسالة trigger الثابتة: T4 يُحوَّل إلى exhausted، وT3 عند COMMIT يُقرأ اسمه", async () => {
    const promotionId = await createPromotion(db, clubId, { code: "ONEUSE", maxRedemptions: 1 });
    const coupon = { promotionId, amountMinor: 1_000, source: "coupon" as const, code: "ONEUSE" };
    await insertRawOrder(db, {
      clubId,
      lines: [{ product: plan, discountMinor: 1_000 }],
      discounts: [coupon],
    });
    const limit = await caught(() =>
      insertRawOrder(db, {
        clubId,
        lines: [{ product: plan, discountMinor: 1_000 }],
        discounts: [coupon],
      }),
    );
    expect(constraintName(limit)).toBe("promotion_redemption_limit");
    expect(mapCommerceDbError(limit)).toMatchObject({ reason: "promotion.exhausted" });
    const totals = await caught(() =>
      insertRawOrder(db, {
        clubId,
        lines: [{ product: plan }],
        head: { subtotalMinor: 50_001, totalMinor: 50_001 },
      }),
    );
    expect(constraintName(totals)).toBe("order_totals_mismatch");
  });

  it("حد العميل في T4 اسم مستقل يُحوَّل إلى customer_limit_reached لا exhausted", async () => {
    const promotionId = await createPromotion(db, clubId, {
      code: "ONEEACH",
      maxRedemptionsPerCustomer: 1,
    });
    const coupon = { promotionId, amountMinor: 1_000, source: "coupon" as const, code: "ONEEACH" };
    const order = {
      clubId,
      lines: [{ product: plan, discountMinor: 1_000 }],
      discounts: [coupon],
    };
    await insertRawOrder(db, order);
    const limit = await caught(() => insertRawOrder(db, order));
    expect(constraintName(limit)).toBe("promotion_customer_limit");
    expect(mapCommerceDbError(limit)).toMatchObject({
      code: "conflict",
      reason: "promotion.customer_limit_reached",
    });
  });

  it("ما ليس خطأ قاعدة لا اسم له", () => {
    expect(constraintName(new Error("boom"))).toBeUndefined();
    expect(constraintName(new DomainError("conflict", "x"))).toBeUndefined();
    expect(constraintName(undefined)).toBeUndefined();
    expect(mapCommerceDbError("text")).toBeUndefined();
  });
});

/** إدراج خام بلا ON CONFLICT: يصطدم بقيد الفرادة. */
function ensureCustomerStrict(club: string) {
  return db.$executeRaw`
    INSERT INTO customers (id, club_id, phone_e164) VALUES (${randomUUID()}::uuid, ${club}::uuid, ${TEST_PHONE})`;
}
