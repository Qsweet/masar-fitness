/**
 * بيئة خادم الدفع في اختبارات المتصفح: مزوّد الاختبار (محاكاة في ذاكرة العملية) على عنوان الجهاز
 * نفسه. القيم هنا ليست أسرارًا: سر إشعار المحاكاة قيمة اختبار ثابتة، ولا مزوّد حقيقي يعرفها.
 */
export const FAKE_WEBHOOK_SECRET = "e2e-fake-webhook-secret-not-a-real-secret";

export const FAKE_PAYMENTS_ENV = {
  PAYMENTS_MODE: "test",
  PAYMENTS_PROVIDER: "fake",
  /** قيمة اختبار، لا قياس WP0: مهلة الطلب التجريبية 30 دقيقة والهامش 5. */
  PAYMENTS_MIN_PAYMENT_MINUTES: "10",
  PAYMENTS_FAKE_WEBHOOK_SECRET: FAKE_WEBHOOK_SECRET,
} as const;
