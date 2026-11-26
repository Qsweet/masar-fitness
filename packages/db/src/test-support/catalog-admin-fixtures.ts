/** مساعدات اختبار إدارة الكتالوج والعروض: مسودات صالحة من دوال المجال نفسها. قيم اختبار لا قرارات. */
import {
  validateProductDraft,
  validateProductTerms,
  validatePromotionDraft,
  type ProductDraft,
  type ProductDraftInput,
  type ProductTerms,
  type PromotionDraft,
  type PromotionDraftInput,
} from "@masar/domain";

const SLUG_SUFFIX_LENGTH = 8;

export function testSlug(prefix = "ct-admin"): string {
  return `${prefix}-${crypto.randomUUID().replaceAll("-", "").slice(0, SLUG_SUFFIX_LENGTH)}`;
}

export const PRODUCT_INPUT: ProductDraftInput = {
  kind: "membership",
  slug: "",
  nameAr: "باقة اختبار",
  nameEn: "Test plan",
  summaryAr: "وصف الباقة.",
  summaryEn: "Plan summary.",
  tierAr: "فئة الاختبار",
  tierEn: "Test tier",
  sortOrder: "3",
  price: "900",
  durationMonths: "3",
  bonusMonths: "1",
  benefits: [
    { ar: "المسبح", en: "Pool", sortOrder: "" },
    { ar: "الساونا", en: "Sauna", sortOrder: "" },
  ],
};

export function productDraft(change: Partial<ProductDraftInput> = {}): ProductDraft {
  const result = validateProductDraft({ ...PRODUCT_INPUT, slug: testSlug(), ...change });
  if (!result.ok) {
    throw new Error(`مسودة منتج اختبار غير صالحة: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

export function productTerms(
  change: Partial<ProductDraftInput> = {},
  kind: "membership" | "addon" = "membership",
): ProductTerms {
  const result = validateProductTerms(kind, { ...PRODUCT_INPUT, ...change });
  if (!result.ok) {
    throw new Error(`شروط اختبار غير صالحة: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

export const PROMOTION_INPUT: PromotionDraftInput = {
  type: "coupon",
  code: "",
  nameAr: "عرض اختبار",
  nameEn: "Test promotion",
  discountKind: "percentage",
  percent: "10",
  amount: "",
  scope: "all_products",
  productIds: [],
  startsAt: "2026-01-01T00:00",
  endsAt: "",
  maxRedemptions: "",
  maxPerCustomer: "",
  stackable: false,
  audience: "anyone",
};

export function promotionDraft(change: Partial<PromotionDraftInput> = {}): PromotionDraft {
  const result = validatePromotionDraft(
    { ...PROMOTION_INPUT, ...change },
    { currency: "SAR", timeZone: "Asia/Riyadh" },
  );
  if (!result.ok) {
    throw new Error(`مسودة عرض اختبار غير صالحة: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}
