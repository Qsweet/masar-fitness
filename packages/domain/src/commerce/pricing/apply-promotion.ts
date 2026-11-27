import { DomainError } from "../../errors";
import { BASIS_POINTS_SCALE } from "./limits";
import {
  checkPromotion,
  isInScope,
  type PromotionCandidate,
  type PromotionContext,
  type PromotionRule,
} from "./promotion";
import { allocateByLargestRemainder, mulDivHalfUp } from "./rounding";

/** سطر كما يراه العرض: منتجه والمتبقي من سعره بعد ما سبقه من خصم (يبدأ بسعر القائمة). */
export interface PricingSlot {
  readonly productId: string;
  readonly remaining: number;
}

/** خصم عرض واحد موزَّعًا على السطور: `shares[i]` نصيب السطر i، ومجموعها `amount`. */
export interface PromotionApplication {
  readonly amount: number;
  readonly shares: readonly number[];
}

/** عرض مؤهل مع خصمه منفردًا على أسعار القائمة. */
export interface EvaluatedPromotion {
  readonly candidate: PromotionCandidate;
  readonly alone: PromotionApplication;
}

export interface RejectedPromotion {
  readonly promotionId: string;
  readonly reason: string;
}

export type CouponEvaluation =
  | { readonly kind: "none" }
  | { readonly kind: "rejected"; readonly error: DomainError }
  | { readonly kind: "eligible"; readonly evaluated: EvaluatedPromotion };

const NOT_APPLICABLE = "promotion.not_applicable";

/** الخصم الثابت لقطة من صف العرض؛ مبلغ غير موجب أو بعملة أخرى عطل في البيانات. */
function fixedAmountMinor(rule: PromotionRule, currency: string): number {
  if (rule.discount.kind !== "fixed_amount") {
    throw new DomainError("invariant", "promotion.discount_kind_mismatch");
  }
  const { amount } = rule.discount;
  const amountCurrency: string = amount.currency;
  if (amountCurrency !== currency || amount.amountMinor <= 0) {
    throw new DomainError("invariant", "promotion.invalid_fixed_amount");
  }
  return amount.amountMinor;
}

/** المئوي بالنصف يُرفع على الأساس، والثابت مقصوص عند الأساس. */
function discountOn(base: number, rule: PromotionRule, currency: string): number {
  switch (rule.discount.kind) {
    case "percentage":
      return mulDivHalfUp(base, rule.discount.rate, BASIS_POINTS_SCALE);
    case "fixed_amount":
      return Math.min(fixedAmountMinor(rule, currency), base);
  }
}

/**
 * خصم العرض على المتبقي: الأساس مجموع متبقي السطور التي يقع منتجها في نطاقه، والتوزيع بالباقي الأكبر
 * بأوزان المتبقي، فلا يتجاوز نصيب سطر متبقيه. أساس صفري أو خصم صفري يعني أن العرض لا ينطبق.
 */
export function applyPromotion(
  rule: PromotionRule,
  slots: readonly PricingSlot[],
  currency: string,
): PromotionApplication | null {
  const weights = slots.map((slot) => (isInScope(rule.scope, slot.productId) ? slot.remaining : 0));
  const base = weights.reduce((sum, weight) => sum + weight, 0);
  if (base === 0) {
    return null;
  }
  const amount = discountOn(base, rule, currency);
  return amount === 0 ? null : { amount, shares: allocateByLargestRemainder(amount, weights) };
}

/** الأعلى خصمًا، ثم الأقدم بداية، ثم المعرّف الأصغر. */
function isPreferred(a: EvaluatedPromotion, b: EvaluatedPromotion): boolean {
  if (a.alone.amount !== b.alone.amount) {
    return a.alone.amount > b.alone.amount;
  }
  const startDiff = a.candidate.rule.startsAt.getTime() - b.candidate.rule.startsAt.getTime();
  if (startDiff !== 0) {
    return startDiff < 0;
  }
  return a.candidate.rule.id < b.candidate.rule.id;
}

/** يقيّم عرضًا مؤهلًا منفردًا على أسعار القائمة، أو يرجع سبب رفضه. */
function evaluate(
  candidate: PromotionCandidate,
  slots: readonly PricingSlot[],
  ctx: PromotionContext,
  currency: string,
): EvaluatedPromotion | DomainError {
  const check = checkPromotion(
    candidate,
    slots.map((slot) => slot.productId),
    ctx,
  );
  if (!check.ok) {
    return check.error;
  }
  const alone = applyPromotion(candidate.rule, slots, currency);
  return alone === null ? new DomainError("conflict", NOT_APPLICABLE) : { candidate, alone };
}

export interface AutomaticSelection {
  readonly best: EvaluatedPromotion | null;
  readonly rejected: readonly RejectedPromotion[];
}

/**
 * يختار من العروض التلقائية المؤهلة واحدًا هو الأعلى خصمًا، ويسجّل سبب رفض الباقين غير المؤهلين. العرض
 * الذي يبلغ خصمه منفردًا إجمالي السلة لا ينطبق: لا يأخذه الزائر مجانًا ولا يمنع البيع.
 */
export function selectAutomatic(
  candidates: readonly PromotionCandidate[],
  slots: readonly PricingSlot[],
  ctx: PromotionContext,
  currency: string,
): AutomaticSelection {
  let best: EvaluatedPromotion | null = null;
  const rejected: RejectedPromotion[] = [];
  const cartTotal = slots.reduce((sum, slot) => sum + slot.remaining, 0);
  for (const candidate of candidates) {
    if (candidate.rule.code !== null) {
      throw new DomainError("invariant", "promotion.automatic_with_code");
    }
    const result = evaluate(candidate, slots, ctx, currency);
    if (result instanceof DomainError) {
      rejected.push({ promotionId: candidate.rule.id, reason: result.reason });
    } else if (result.alone.amount >= cartTotal) {
      // عرض تلقائي يُصفّر السلة يُسقط كل بيع (`cart.zero_total`): لا ينطبق، والسلة تُسعَّر بدونه
      rejected.push({ promotionId: candidate.rule.id, reason: NOT_APPLICABLE });
    } else if (best === null || isPreferred(result, best)) {
      best = result;
    }
  }
  return { best, rejected };
}

/** يقيّم الكوبون منفردًا. رفضه يُرجَع بخطئه ولا يُتجاهل. */
export function evaluateCoupon(
  candidate: PromotionCandidate | null,
  slots: readonly PricingSlot[],
  ctx: PromotionContext,
  currency: string,
): CouponEvaluation {
  if (candidate === null) {
    return { kind: "none" };
  }
  if (candidate.rule.code === null) {
    throw new DomainError("invariant", "promotion.coupon_without_code");
  }
  const result = evaluate(candidate, slots, ctx, currency);
  return result instanceof DomainError
    ? { kind: "rejected", error: result }
    : { kind: "eligible", evaluated: result };
}
