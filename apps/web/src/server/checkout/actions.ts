"use server";

import { parseBuyer, parseCouponCode } from "@masar/domain";
import { redirect } from "next/navigation";
import { localizedPath } from "@/i18n/locales";
import { requireCheckout } from "./flag";
import { parseCheckoutForm, typedValues } from "./form-schema";
import { domainFieldErrors, stateAfterRejection, type CheckoutFormState } from "./form-state";
import { placeOrder } from "./place-order";
import { checkoutThrottledError, publicSubmitError } from "./public-errors";
import { allowSubmitForMobile, allowSubmitFromIp, requestIp } from "./throttle";

function throttled(state: CheckoutFormState): CheckoutFormState {
  return { ...state, errors: domainFieldErrors([checkoutThrottledError()]) };
}

/**
 * إجراء نموذج بيانات الشراء. الترتيب ثابت: العلم أولًا (404 بلا أي قراءة)، ثم حد العنوان، ثم شكل
 * النموذج، ثم الاسم والجوال والكوبون معًا، ثم حد الجوال، ثم الإنشاء، ثم التحويل إلى صفحة الطلب.
 * لا قيمة من النموذج تُعتمد سعرًا: الإجمالي المرسل للمقارنة فقط، والسعر يُحسب من القاعدة.
 * الحدّان يبطئان السكربت لا يمنعان منتحل الجوال: التحقق من الجوال شرط قبل فتح البيع للعموم.
 */
export async function submitCheckout(
  prev: CheckoutFormState,
  formData: FormData,
): Promise<CheckoutFormState> {
  requireCheckout();
  const state: CheckoutFormState = { ...prev, values: typedValues(formData), notice: null };
  if (!allowSubmitFromIp(await requestIp())) {
    return throttled(state);
  }
  const form = parseCheckoutForm(formData);
  if (!form.ok) {
    return { ...state, errors: form.errors };
  }
  const buyer = parseBuyer({ name: form.value.name, mobile: form.value.mobile });
  const coupon = parseCouponCode(form.value.coupon);
  if (!buyer.ok || !coupon.ok) {
    const errors = [...(buyer.ok ? [] : buyer.error), ...(coupon.ok ? [] : [coupon.error])];
    return { ...state, errors: domainFieldErrors(errors) };
  }
  if (!allowSubmitForMobile(buyer.value.mobile)) {
    return throttled(state);
  }
  const placed = await placeOrder({
    slug: form.value.slug,
    addonSlugs: form.value.addons,
    couponCode: coupon.value,
    buyer: buyer.value,
    locale: form.value.locale,
    idempotencyKey: form.value.idempotencyKey,
    quotedTotalMinor: form.value.quotedTotalMinor,
  });
  if (!placed.ok) {
    return stateAfterRejection(state, publicSubmitError(placed.error), form.value.locale);
  }
  redirect(localizedPath(form.value.locale, `/checkout/orders/${placed.value.publicToken}`));
}
