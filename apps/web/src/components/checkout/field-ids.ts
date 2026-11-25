import type { CheckoutField } from "@/server/checkout/form-schema";

/**
 * معرّفات الحقول الظاهرة في صفحة الشراء: ملخص الأخطاء يربط إليها، والكوبون في نموذج الخيارات
 * بينما الاسم والجوال في نموذج البيانات.
 */
export const FIELD_IDS: Readonly<Record<Exclude<CheckoutField, "form">, string>> = {
  name: "buyer-name",
  mobile: "buyer-mobile",
  coupon: "coupon",
};

/** ترتيب عرض الأخطاء في الملخص: ترتيب الحقول في الصفحة، ثم خطأ النموذج العام. */
export const FIELD_ORDER: readonly CheckoutField[] = ["coupon", "name", "mobile", "form"];

export function errorId(field: CheckoutField): string {
  return `${field}-error`;
}
