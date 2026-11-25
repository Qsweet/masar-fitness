/**
 * بنّاءات بيانات لاختبارات التسعير فقط (لا تُصدَّر من الحزمة). الأرقام تُمرَّر من الاختبار نفسه.
 */
import { money } from "../../money";
import type { CartLine, PurchasableKind } from "./cart";
import type { PromotionCandidate, PromotionRule } from "./promotion";

export function cartLine(
  kind: PurchasableKind,
  productId: string,
  priceMinor: number,
  extra: Partial<CartLine> = {},
): CartLine {
  return {
    productId,
    versionId: `${productId}-v1`,
    kind,
    slug: productId,
    name: { ar: `اسم ${productId}`, en: `Name ${productId}` },
    summary: { ar: "ملخص", en: "Summary" },
    benefits: [],
    listPrice: money(priceMinor),
    paidMonths: null,
    bonusMonths: 0,
    sortOrder: 0,
    ...extra,
  };
}

type RuleSeed = Partial<PromotionRule> & Pick<PromotionRule, "id" | "discount">;

/** عرض نشط مفتوح للجميع على كل المنتجات بلا حدود، ما لم يُغيَّر. */
export function promotionRule(seed: RuleSeed): PromotionRule {
  return {
    code: null,
    name: { ar: `عرض ${seed.id}`, en: `Promotion ${seed.id}` },
    status: "active",
    audience: "anyone",
    scope: { kind: "all_products" },
    stackable: false,
    startsAt: new Date(0),
    endsAt: null,
    maxRedemptions: null,
    maxRedemptionsPerCustomer: null,
    ...seed,
  };
}

export function candidate(rule: PromotionRule, total = 0, byCustomer = 0): PromotionCandidate {
  return { rule, usage: { total, byCustomer } };
}

/** ثوابت mulberry32 كما نشرها مؤلفها؛ لا معنى عمل لها. */
const MULBERRY_INCREMENT = 0x6d2b79f5;
const MULBERRY_SHIFT_A = 15;
const MULBERRY_SHIFT_B = 7;
const MULBERRY_SHIFT_C = 14;
const MULBERRY_ODD = 61;
const UINT32_RANGE = 0x1_0000_0000;

/**
 * مولّد أعداد شبه عشوائية ببذرة ثابتة (mulberry32) لاختبارات الخصائص: نتائجه تتكرر في كل تشغيل.
 */
export function seededRandom(seed: number): (maxExclusive: number) => number {
  let state = seed >>> 0;
  return (maxExclusive) => {
    state = (state + MULBERRY_INCREMENT) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> MULBERRY_SHIFT_A), t | 1);
    t ^= t + Math.imul(t ^ (t >>> MULBERRY_SHIFT_B), t | MULBERRY_ODD);
    const unit = ((t ^ (t >>> MULBERRY_SHIFT_C)) >>> 0) / UINT32_RANGE;
    return Math.floor(unit * maxExclusive);
  };
}
