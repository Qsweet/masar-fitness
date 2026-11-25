import "server-only";
import { DomainError } from "@masar/domain";

/** نص واحد لكل رفض كوبون في صفحة العرض العامة، فلا تكشف الصفحة أي رمز موجود أو مسودة أو قادم. */
export const COUPON_REJECTED = "coupon.rejected";
/** تجاوز حد فحوص الكوبون من العنوان: لا يُفحص الرمز، ويُعرض السعر بلا خصم. */
export const COUPON_THROTTLED = "coupon.throttled";
/** تجاوز حد إرسالات نموذج الشراء من العنوان أو للجوال. */
export const CHECKOUT_THROTTLED = "checkout.throttled";

/** أسباب لا تكشف شيئًا عن الرموز: الصيغة، والأهلية التي تُحسم بعد الجوال (معلومة لا رفض). */
const QUOTE_DETAILED = new Set(["coupon.invalid_format", "promotion.audience_unverified"]);
/**
 * أسباب تكشف وجود رمز غير معلن (مسودة أو مؤرشف أو لم يبدأ) فتُعرض كالرمز غير الموجود بعد
 * الإرسال أيضًا. ما عداها (نفد، بلغت حدك، لا يخصك…) يخص رمزًا صالحًا ويفيد صاحبه.
 */
const SUBMIT_HIDDEN = new Set(["coupon.unknown", "promotion.inactive", "promotion.not_started"]);

function couponRejected(cause: DomainError): DomainError {
  return new DomainError("validation", COUPON_REJECTED, { field: "coupon", cause });
}

/** خطأ الكوبون كما يُعرض في صفحة العرض العامة: الصيغة والأهلية بتفصيلهما، وكل رفض آخر نص واحد. */
export function publicQuoteCouponError(error: DomainError | null): DomainError | null {
  if (error === null || QUOTE_DETAILED.has(error.reason)) {
    return error;
  }
  return couponRejected(error);
}

/** خطأ الإنشاء كما يُعرض بعد الإرسال: أسباب وجود الرمز تُطوى في النص العام، والباقي كما هو. */
export function publicSubmitError(error: DomainError): DomainError {
  return SUBMIT_HIDDEN.has(error.reason) ? couponRejected(error) : error;
}

export function couponThrottledError(): DomainError {
  return new DomainError("conflict", COUPON_THROTTLED, { field: "coupon" });
}

export function checkoutThrottledError(): DomainError {
  return new DomainError("conflict", CHECKOUT_THROTTLED);
}
