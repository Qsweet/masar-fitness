import type { DomainError } from "../../errors";
import { ok, type Result } from "../../result";
import type { MembershipStartRule } from "../lifecycle";
import { priceCart, validateCart, type CouponOutcome, type PricedCart } from "../pricing";
import { checkoutBlockers, type UndecidedPolicy } from "./commerce-policy";
import { couponFieldError, unknownCouponError, type OrderFacts } from "./order-draft";

/** حقائق عرض السعر: قبل معرفة المشتري، فلا اسم ولا جوال ولا مكانة ولا طلبات معلّقة. */
export type QuoteFacts = Omit<OrderFacts, "buyer" | "customer" | "maxPendingOrders" | "locale">;

export type Quote = PricedCart & {
  /** السياسات غير المحسومة: تُعرض فتقرر الصفحة «غير متاح»، ولا تُرجَع خطأً هنا. */
  readonly blockers: readonly UndecidedPolicy[];
  /**
   * خطأ الكوبون على حقله، والسعر المعروض بلا خصمه. السبب `promotion.audience_unverified`
   * ليس رفضًا نهائيًا: الأهلية تُتحقق عند التأكيد بالمكانة الحقيقية.
   */
  readonly couponError: DomainError | null;
  /** القاعدة التي ستُختم على سطر الاشتراك، وnull لغيره أو ما دامت غير محسومة. */
  readonly membershipStartRule: MembershipStartRule | null;
};

function couponErrorOf(facts: QuoteFacts, outcome: CouponOutcome): DomainError | null {
  if (facts.coupon.kind === "unknown_code") {
    return unknownCouponError();
  }
  return outcome.kind === "rejected" ? couponFieldError("validation", outcome.error) : null;
}

/**
 * عرض السعر قبل الجوال: المكانة `unknown`، فالعرض المقيَّد بجمهور أو بحد للعميل لا يُطبَّق
 * ويُعلَّم `promotion.audience_unverified`. يستعمل محرك التسعير نفسه الذي يكتب الطلب.
 */
export function buildQuote(facts: QuoteFacts): Result<Quote, DomainError> {
  const lines = validateCart(facts);
  if (!lines.ok) {
    return lines;
  }
  const priced = priceCart({
    lines: lines.value,
    automatic: facts.automatic,
    coupon: facts.coupon.kind === "found" ? facts.coupon.candidate : null,
    vatRate: facts.policy.vatRate,
    now: facts.now,
    standing: "unknown",
  });
  if (!priced.ok) {
    return priced;
  }
  const isMembership = facts.primary.kind === "membership";
  return ok({
    ...priced.value,
    blockers: checkoutBlockers(facts.policy, facts.primary.kind),
    couponError: couponErrorOf(facts, priced.value.couponOutcome),
    membershipStartRule: isMembership ? facts.policy.membershipStartRule : null,
  });
}
