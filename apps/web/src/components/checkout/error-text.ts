import type { Dictionary } from "@/i18n/dictionaries";

/**
 * أسباب الأخطاء التي تصل إلى العميل في مسار الشراء. القاموس مضبوط على هذه القائمة بالأنواع،
 * فسبب بلا ترجمة خطأ أنواع لا نص فارغ. أي سبب غير معروف يُعرض بالنص العام. أسباب وجود الكوبون
 * (غير موجود، غير مفعّل، لم يبدأ) ليست هنا عمدًا: تُطوى في `coupon.rejected` (server/checkout/public-errors.ts).
 */
export const CHECKOUT_ERROR_REASONS = [
  "buyer.name_too_short",
  "buyer.name_too_long",
  "buyer.name_invalid",
  "mobile.invalid_characters",
  "mobile.not_saudi_mobile",
  "coupon.invalid_format",
  "coupon.rejected",
  "coupon.throttled",
  "promotion.ended",
  "promotion.exhausted",
  "promotion.customer_limit_reached",
  "promotion.audience_mismatch",
  "promotion.audience_unverified",
  "promotion.not_applicable",
  "cart.product_unavailable",
  "cart.addon_not_attachable",
  "cart.addon_duplicate",
  "cart.too_many_addons",
  "cart.addon_requires_membership",
  "cart.zero_total",
  "cart.amount_out_of_range",
  "order.too_many_pending",
  "checkout.throttled",
  "policy.undecided",
  "form.invalid",
  "form.generic",
] as const;

export type CheckoutErrorReason = (typeof CHECKOUT_ERROR_REASONS)[number];

/** السياسات غير المحسومة كلها (`policy.undecided.<name>`) نص واحد: الشراء غير متاح. */
const UNDECIDED_PREFIX = "policy.undecided.";

export function isCheckoutErrorReason(reason: string): reason is CheckoutErrorReason {
  return (CHECKOUT_ERROR_REASONS as readonly string[]).includes(reason);
}

/** يحوّل سبب DomainError إلى سبب معروف للعرض؛ غير المعروف يصبح `form.generic`. */
export function displayReason(reason: string): CheckoutErrorReason {
  if (reason.startsWith(UNDECIDED_PREFIX)) {
    return "policy.undecided";
  }
  return isCheckoutErrorReason(reason) ? reason : "form.generic";
}

/** نص السبب من القاموس بلغة الصفحة. */
export function errorText(reason: string, dictionary: Dictionary): string {
  const texts: Readonly<Record<CheckoutErrorReason, string>> = dictionary.checkout.errors;
  return texts[displayReason(reason)];
}
