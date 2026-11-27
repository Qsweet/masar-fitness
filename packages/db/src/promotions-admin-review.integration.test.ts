import { randomUUID } from "node:crypto";
import type { PromotionDraftInput } from "@masar/domain";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createDb,
  createOrder,
  createPromotion,
  getPromotionDetail,
  listPromotionProductOptions,
  setPromotionStatus,
  staffActor,
  updatePromotion,
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
  failure,
  orderInput,
  testBuyer,
  testDatabaseUrl,
  testPhone,
  unwrap,
} from "./test-support/commerce-orders";
import { resetCommerceTables } from "./test-support/reset-database";
import { createTestStaff } from "./test-support/staff-fixtures";

/**
 * تصحيحات المراجعة المستقلة لـWP9: الجمهور المقيَّد لا يُعدَّل من الخادم، والمؤرشف لا يُضاف إلى نطاق
 * عرض، وبداية بثوانٍ لا تجمّد عرضًا مستعملًا عن كل تعديل.
 */
const PRICE = 90_000;
const TEN_OFF = 81_000;
const LATER = new Date(TEST_NOW.getTime() + 60_000);

let db: Db;
let clubId: string;
let plan: TestProduct;
let archived: TestProduct;
let actor: ReturnType<typeof staffActor>;
let codeIndex = 0;

function nextCode(): string {
  codeIndex += 1;
  return `REV${String(codeIndex).padStart(4, "0")}`;
}

async function detailOf(promotionId: string): Promise<PromotionAdminRow> {
  const detail = await getPromotionDetail(db, clubId, promotionId, LATER);
  if (detail === undefined) {
    throw new Error("العرض غير موجود");
  }
  return detail;
}

async function newPromotion(change: Partial<PromotionDraftInput> = {}) {
  const promotionId = randomUUID();
  const draft = promotionDraft({ code: nextCode(), ...change });
  return {
    promotionId,
    created: await createPromotion(db, { promotionId, clubId, draft, actor, now: TEST_NOW }),
  };
}

function update(promotion: PromotionAdminRow, change: Partial<PromotionDraftInput>) {
  return updatePromotion(db, {
    promotionId: promotion.rule.id,
    clubId,
    lockToken: promotion.lockToken,
    draft: promotionDraft({ code: promotion.rule.code ?? "", ...change }),
    actor,
    now: LATER,
  });
}

beforeAll(async () => {
  db = createDb(testDatabaseUrl());
  await resetCommerceTables(db);
  clubId = await createTestClub(db);
  plan = await createPlan(db, clubId, { priceMinor: PRICE, durationMonths: 1 });
  archived = await createPlan(db, clubId, { priceMinor: PRICE, durationMonths: 3 });
  await db.product.update({ where: { id: archived.productId }, data: { status: "archived" } });
  actor = staffActor((await createTestStaff(db, clubId, { role: "manager" })).id);
});

beforeEach(async () => {
  await db.$executeRaw`
    TRUNCATE audit_logs, memberships, order_discounts, order_items, orders, customers,
      promotions CASCADE`;
});

afterAll(async () => {
  await resetCommerceTables(db);
  await db.$disconnect();
});

describe("مراجعة WP9", () => {
  it("عرض بجمهور مقيَّد (من خارج اللوحة) لا يصير «للجميع» بحفظ مصنوع", async () => {
    const { promotionId } = await newPromotion();
    await db.$executeRaw`UPDATE promotions SET audience = 'new_customer' WHERE id = ${promotionId}::uuid`;
    const restricted = await detailOf(promotionId);
    expect(failure(await update(restricted, { nameEn: "Anyone now" })).reason).toBe(
      "promotion.audience_restricted",
    );
    expect((await detailOf(promotionId)).rule).toMatchObject({
      audience: "new_customer",
      name: { en: "Test promotion" },
    });
  });

  it("المؤرشف لا يُضاف إلى النطاق عند الإنشاء ولا التعديل، وما أُرشف بعد إضافته لا يمنع الحفظ", async () => {
    const listed = (ids: string[]) => ({ scope: "listed_products", productIds: ids }) as const;
    const refused = await newPromotion(listed([plan.productId, archived.productId]));
    expect(failure(refused.created)).toMatchObject({
      reason: "promotion.products_invalid",
      field: "scope",
    });
    const { promotionId } = await newPromotion(listed([plan.productId]));
    const created = await detailOf(promotionId);
    expect(
      failure(await update(created, listed([plan.productId, archived.productId]))).reason,
    ).toBe("promotion.products_invalid");
    // منتج في النطاق ثم أُرشف: يبقى خيارًا محدَّدًا، والحفظ به يُقبل
    const later = await createPlan(db, clubId, { priceMinor: PRICE, durationMonths: 6 });
    unwrap(await update(created, listed([plan.productId, later.productId])));
    await db.product.update({ where: { id: later.productId }, data: { status: "archived" } });
    const withArchived = await detailOf(promotionId);
    const options = await listPromotionProductOptions(db, clubId, [later.productId]);
    expect(options.map((option) => option.id)).toContain(later.productId);
    expect(options.map((option) => option.id)).not.toContain(archived.productId);
    unwrap(
      await update(withArchived, { ...listed([plan.productId, later.productId]), nameEn: "Kept" }),
    );
    expect((await detailOf(promotionId)).rule.scope).toMatchObject({
      productIds: [plan.productId, later.productId].sort(),
    });
  });

  it("بداية بثوانٍ وعرض مستعمل: الاسم يُعدَّل، والبداية تبقى بثوانيها", async () => {
    const { promotionId } = await newPromotion();
    const withSeconds = new Date("2025-12-31T21:00:42.500Z");
    await db.$executeRaw`UPDATE promotions SET starts_at = ${withSeconds} WHERE id = ${promotionId}::uuid`;
    const draft = await detailOf(promotionId);
    unwrap(
      await setPromotionStatus(db, {
        promotionId,
        clubId,
        lockToken: draft.lockToken,
        action: "activate",
        actor,
        now: LATER,
      }),
    );
    const active = await detailOf(promotionId);
    unwrap(
      await createOrder(
        db,
        orderInput(plan.slug, TEN_OFF, {
          couponCode: active.rule.code,
          buyer: testBuyer(testPhone(990)),
          now: LATER,
        }),
      ),
    );
    const used = await detailOf(promotionId);
    // النموذج يرسل البداية بدقيقتها (2026-01-01T00:00 بتوقيت الرياض)
    unwrap(await update(used, { nameAr: "اسم جديد" }));
    expect((await detailOf(promotionId)).rule).toMatchObject({
      name: { ar: "اسم جديد" },
      startsAt: withSeconds,
    });
    expect(
      failure(await update(await detailOf(promotionId), { startsAt: "2026-01-01T00:01" })).reason,
    ).toBe("promotion.terms_frozen");
  });
});
