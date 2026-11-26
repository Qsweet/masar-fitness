import type { LocalizedText } from "../../catalog/membership-plan";
import { DomainError } from "../../errors";
import type { Money } from "../../money";
import { err, ok, type Result } from "../../result";
import type { CouponCode } from "./coupon-code";
import type { BasisPoints } from "./vat";

/** `paused`: أوقفه الموظف مؤقتًا (يُفعَّل من جديد)، غير المسودة التي لم تُفعَّل قط. */
export const PROMOTION_STATUSES = ["draft", "active", "paused", "archived"] as const;
export type PromotionStatus = (typeof PROMOTION_STATUSES)[number];
export type PromotionAudience = "anyone" | "new_customer" | "existing_customer";

export type PromotionDiscount =
  | { readonly kind: "percentage"; readonly rate: BasisPoints }
  | { readonly kind: "fixed_amount"; readonly amount: Money };

export type PromotionScope =
  | { readonly kind: "all_products" }
  | { readonly kind: "listed_products"; readonly productIds: readonly string[] };

/** عرض تلقائي (`code` فارغ) أو كوبون، كما في صف `promotions` وروابط منتجاته. */
export interface PromotionRule {
  readonly id: string;
  readonly code: CouponCode | null;
  readonly name: LocalizedText;
  readonly status: PromotionStatus;
  readonly discount: PromotionDiscount;
  readonly audience: PromotionAudience;
  readonly scope: PromotionScope;
  readonly stackable: boolean;
  readonly startsAt: Date;
  /** نهاية غير مشمولة: النافذة `[startsAt, endsAt)`. */
  readonly endsAt: Date | null;
  readonly maxRedemptions: number | null;
  readonly maxRedemptionsPerCustomer: number | null;
}

/** العرض مع استخداماته النشطة المعدودة تحت القفل (إجمالًا ولهذا العميل). */
export interface PromotionCandidate {
  readonly rule: PromotionRule;
  readonly usage: { readonly total: number; readonly byCustomer: number };
}

/**
 * مكانة العميل: `unknown` قبل معرفة الجوال (عرض السعر)، فلا يُطبَّق عليه عرض مقيَّد بجمهور أو بحد للعميل.
 */
export type CustomerStanding = "new" | "existing" | "unknown";

export interface PromotionContext {
  readonly now: Date;
  readonly standing: CustomerStanding;
}

type Check = Result<true, DomainError>;

const PASS: Check = ok(true);

function reject(reason: string): Check {
  return err(new DomainError("conflict", reason));
}

/** هل يقع منتج من السلة في نطاق العرض؟ نطاق قائمة بلا منتجات لا ينطبق على شيء. */
export function isInScope(scope: PromotionScope, productId: string): boolean {
  return scope.kind === "all_products" || scope.productIds.includes(productId);
}

function checkTiming(rule: PromotionRule, now: Date): Check {
  if (rule.status !== "active") {
    return reject("promotion.inactive");
  }
  if (now.getTime() < rule.startsAt.getTime()) {
    return reject("promotion.not_started");
  }
  if (rule.endsAt !== null && rule.endsAt.getTime() <= now.getTime()) {
    return reject("promotion.ended");
  }
  return PASS;
}

const AUDIENCE_STANDING: Record<Exclude<PromotionAudience, "anyone">, CustomerStanding> = {
  new_customer: "new",
  existing_customer: "existing",
};

function checkAudience(rule: PromotionRule, standing: CustomerStanding): Check {
  const restricted = rule.audience !== "anyone" || rule.maxRedemptionsPerCustomer !== null;
  if (standing === "unknown" && restricted) {
    return reject("promotion.audience_unverified");
  }
  if (rule.audience !== "anyone" && AUDIENCE_STANDING[rule.audience] !== standing) {
    return reject("promotion.audience_mismatch");
  }
  return PASS;
}

function reachedLimit(used: number, limit: number | null): boolean {
  return limit !== null && used >= limit;
}

function checkUsage(candidate: PromotionCandidate): Check {
  const { rule, usage } = candidate;
  if (reachedLimit(usage.total, rule.maxRedemptions)) {
    return reject("promotion.exhausted");
  }
  if (reachedLimit(usage.byCustomer, rule.maxRedemptionsPerCustomer)) {
    return reject("promotion.customer_limit_reached");
  }
  return PASS;
}

/**
 * أهلية العرض بترتيب ثابت: الحالة، ثم النافذة، ثم النطاق، ثم الجمهور، ثم الحد الكلي، ثم حد العميل.
 * أول سبب رفض يُرجَع بصنف conflict.
 */
export function checkPromotion(
  candidate: PromotionCandidate,
  productIds: readonly string[],
  ctx: PromotionContext,
): Check {
  const { rule } = candidate;
  const timing = checkTiming(rule, ctx.now);
  if (!timing.ok) {
    return timing;
  }
  if (!productIds.some((productId) => isInScope(rule.scope, productId))) {
    return reject("promotion.not_applicable");
  }
  const audience = checkAudience(rule, ctx.standing);
  return audience.ok ? checkUsage(candidate) : audience;
}
