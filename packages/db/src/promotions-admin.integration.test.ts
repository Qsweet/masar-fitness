import { randomUUID } from "node:crypto";
import type { PromotionDraftInput, PromotionStatusAction } from "@masar/domain";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  cancelPendingOrder,
  createDb,
  createOrder,
  createPromotion,
  expireDueOrders,
  getPromotionDetail,
  listPromotionProductOptions,
  listPromotionsWithUsage,
  markOrderPaid,
  quoteCart,
  setPromotionStatus,
  staffActor,
  type Db,
  type PromotionAdminRow,
} from "./index";
import { promotionDraft } from "./test-support/catalog-admin-fixtures";
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
import { resetCommerceTables } from "./test-support/reset-database";
import { createTestStaff } from "./test-support/staff-fixtures";

const PRICE = 90_000;
const TEN_OFF = 81_000;
const MINUTE_MS = 60_000;
const LATER = new Date(TEST_NOW.getTime() + MINUTE_MS);
const AFTER_WINDOW = new Date(TEST_NOW.getTime() + 31 * MINUTE_MS);

let db: Db;
let other: Db;
let clubId: string;
let otherClubId: string;
let plan: TestProduct;
let actor: ReturnType<typeof staffActor>;
let phoneIndex = 500;
let codeIndex = 0;

function nextCode(): string {
  codeIndex += 1;
  return `ADM${String(codeIndex).padStart(4, "0")}`;
}

function nextBuyer() {
  phoneIndex += 1;
  return testBuyer(testPhone(phoneIndex));
}

async function detailOf(promotionId: string, now = LATER): Promise<PromotionAdminRow> {
  const detail = await getPromotionDetail(db, clubId, promotionId, now);
  if (detail === undefined) {
    throw new Error("العرض غير موجود");
  }
  return detail;
}

async function newPromotion(change: Partial<PromotionDraftInput> = {}): Promise<PromotionAdminRow> {
  const promotionId = randomUUID();
  const draft = promotionDraft({ code: nextCode(), ...change });
  unwrap(await createPromotion(db, { promotionId, clubId, draft, actor, now: TEST_NOW }));
  return detailOf(promotionId);
}

function setStatus(promotion: PromotionAdminRow, action: PromotionStatusAction, now = LATER) {
  return setPromotionStatus(db, {
    promotionId: promotion.rule.id,
    clubId,
    lockToken: promotion.lockToken,
    action,
    actor,
    now,
  });
}

async function activated(change: Partial<PromotionDraftInput> = {}): Promise<PromotionAdminRow> {
  const promotion = await newPromotion(change);
  unwrap(await setStatus(promotion, "activate"));
  return detailOf(promotion.rule.id);
}

function orderWith(promotion: PromotionAdminRow, total = TEN_OFF, now = LATER) {
  const code = promotion.rule.code;
  return createOrder(
    db,
    orderInput(plan.slug, total, { couponCode: code, buyer: nextBuyer(), now }),
  );
}

beforeAll(async () => {
  db = createDb(testDatabaseUrl());
  [other] = createDbClients(1) as [Db];
  await resetCommerceTables(db);
  clubId = await createTestClub(db);
  otherClubId = await createTestClub(db);
  plan = await createPlan(db, clubId, { priceMinor: PRICE, durationMonths: 1 });
  actor = staffActor((await createTestStaff(db, clubId, { role: "manager" })).id);
});

beforeEach(async () => {
  await db.$executeRaw`
    TRUNCATE audit_logs, memberships, order_discounts, order_items, orders, customers,
      promotions CASCADE`;
});

afterAll(async () => {
  await resetCommerceTables(db);
  await disconnectAll([db, other]);
});

describe("createPromotion", () => {
  it("ينشئ مسودة بسطر تدقيق فيه الرمز وشكل الخصم والحدّان", async () => {
    const promotion = await newPromotion({ maxRedemptions: "5", maxPerCustomer: "1" });
    expect(promotion).toMatchObject({
      state: "draft",
      rule: {
        status: "draft",
        audience: "anyone",
        maxRedemptions: 5,
        maxRedemptionsPerCustomer: 1,
      },
      usage: { total: 0, active: 0, paidOrders: 0, discountGranted: { amountMinor: 0 } },
    });
    const [audit] = await db.auditLog.findMany({ where: { entityId: promotion.rule.id } });
    expect(audit).toMatchObject({
      entityType: "promotion",
      action: "promotion_created",
      toState: "draft",
      actor,
      data: {
        code: promotion.rule.code,
        discountKind: "percentage",
        percentBps: 1000,
        maxRedemptions: 5,
        maxPerCustomer: 1,
      },
    });
  });

  it("المسودة لا يقبلها التسعير حتى تُفعَّل", async () => {
    const promotion = await newPromotion();
    const request = { planSlug: plan.slug, addonSlugs: [], couponCode: promotion.rule.code };
    expect(unwrap(await quoteCart(db, request, LATER)).couponError).toMatchObject({
      reason: "promotion.inactive",
    });
    unwrap(await setStatus(promotion, "activate"));
    expect(unwrap(await quoteCart(db, request, LATER)).total.amountMinor).toBe(TEN_OFF);
  });

  it("رمز مكرر ولو لعرض مؤرشف ⇒ promotion.code_taken على الحقل؛ ونادٍ آخر يستعمله", async () => {
    const promotion = await newPromotion();
    unwrap(await setStatus(promotion, "end"));
    const draft = promotionDraft({ code: promotion.rule.code ?? "" });
    const input = { promotionId: randomUUID(), clubId, draft, actor, now: LATER };
    const taken = failure(await createPromotion(db, input));
    expect(taken).toMatchObject({
      code: "conflict",
      reason: "promotion.code_taken",
      field: "code",
    });
    expect((await createPromotion(db, { ...input, clubId: otherClubId })).ok).toBe(true);
  });

  it("الإرسال الثاني بالمعرّف نفسه إعادة، وعرضان تلقائيان بلا رمز لا يتصادمان", async () => {
    const promotionId = randomUUID();
    const draft = promotionDraft({ code: nextCode() });
    const input = { promotionId, clubId, draft, actor, now: TEST_NOW };
    expect(unwrap(await createPromotion(db, input)).replayed).toBe(false);
    expect(unwrap(await createPromotion(db, input)).replayed).toBe(true);
    expect(await db.auditLog.count({ where: { entityId: promotionId } })).toBe(1);
    await newPromotion({ type: "automatic" });
    await newPromotion({ type: "automatic" });
    expect(await listPromotionsWithUsage(db, clubId, LATER)).toHaveLength(3);
  });

  it("نطاق القائمة: منتج من نادٍ آخر مرفوض، ومنتج النادي يُحفظ باسمه", async () => {
    const foreign = await createPlan(db, otherClubId, { priceMinor: 1_000, durationMonths: 1 });
    const draft = promotionDraft({
      code: nextCode(),
      scope: "listed_products",
      productIds: [foreign.productId],
    });
    const refused = failure(
      await createPromotion(db, { promotionId: randomUUID(), clubId, draft, actor, now: TEST_NOW }),
    );
    expect(refused).toMatchObject({ code: "validation", reason: "promotion.products_invalid" });
    const listed = await newPromotion({ scope: "listed_products", productIds: [plan.productId] });
    expect(listed.products).toEqual([
      { id: plan.productId, name: { ar: "منتج اختبار", en: "Test product" } },
    ]);
    const options = await listPromotionProductOptions(db, clubId);
    expect(options.map((option) => option.id)).toEqual([plan.productId]);
  });
});

describe("listPromotionsWithUsage", () => {
  it("العدّادات تطابق T4: الطلب المنتهي والملغى لا يُعدّان نشطين، والمدفوع يُجمع خصمه", async () => {
    const promotion = await activated();
    const paid = unwrap(await orderWith(promotion));
    const cancelled = unwrap(await orderWith(promotion));
    const lapsed = unwrap(await orderWith(promotion));
    unwrap(await orderWith(promotion, TEN_OFF, new Date(AFTER_WINDOW.getTime() - MINUTE_MS)));
    const payment = {
      provider: "test_pay",
      providerPaymentId: "adm-1",
      amountMinor: TEN_OFF,
      currency: "SAR",
    };
    unwrap(
      await markOrderPaid(db, { orderId: paid.orderId, payment, actor: "provider", now: LATER }),
    );
    unwrap(
      await cancelPendingOrder(db, {
        orderId: cancelled.orderId,
        clubId,
        reasonCode: "other",
        actor,
        now: LATER,
      }),
    );
    // قبل كتابة الانتهاء: المعلّق الفائتة مهلته ما زال حاجزًا (الاتجاه الآمن في loadUsage و T4)
    const before = await detailOf(promotion.rule.id, AFTER_WINDOW);
    expect(before.usage).toMatchObject({ total: 4, active: 3, paidOrders: 1 });
    await expireDueOrders(db, { now: AFTER_WINDOW, limit: 10 });
    const after = await detailOf(promotion.rule.id, AFTER_WINDOW);
    expect(after.usage).toMatchObject({ total: 4, active: 2, paidOrders: 1 });
    expect(after.usage.discountGranted).toMatchObject({
      amountMinor: PRICE - TEN_OFF,
      currency: "SAR",
    });
    expect(await db.order.findUniqueOrThrow({ where: { id: lapsed.orderId } })).toMatchObject({
      status: "expired",
    });
  });

  it("الحالة المعروضة: مجدول، سارٍ، مستنفد، منتهٍ، متوقف، مؤرشف؛ وعزل النادي", async () => {
    const scheduled = await activated({ startsAt: "2027-01-01T00:00" });
    const running = await activated();
    const exhausted = await activated({ maxRedemptions: "1" });
    unwrap(await orderWith(exhausted));
    const ended = await activated({ endsAt: "2026-02-01T00:00" });
    const paused = await activated();
    unwrap(await setStatus(paused, "pause"));
    const archived = await newPromotion();
    unwrap(await setStatus(archived, "end"));
    const draft = await newPromotion();
    const rows = await listPromotionsWithUsage(db, clubId, LATER);
    const stateOf = (row: PromotionAdminRow) => rows.find((r) => r.rule.id === row.rule.id)?.state;
    expect([scheduled, running, exhausted, ended, paused, archived, draft].map(stateOf)).toEqual([
      "scheduled",
      "running",
      "exhausted",
      "ended",
      "paused",
      "archived",
      "draft",
    ]);
    expect(await listPromotionsWithUsage(db, otherClubId, LATER)).toEqual([]);
    expect(await getPromotionDetail(db, otherClubId, running.rule.id, LATER)).toBeUndefined();
  });
});
