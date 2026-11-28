/**
 * تقليل البيانات (القرار 90-6، ADMIN_A5_TRACKING §7.1): معرّفات القياس المختومة مع الطلب (العنوان
 * والوكيل ومعرّفات النقر وكوكيات المنصات ورابط الصفحة) تُفرَّغ بعد 90 يومًا من إنشاء الطلب. 90 يومًا
 * أطول نافذة إسناد للنقر عند المنصات المفعّلة: Google Ads يقبل نافذة تحويل من يوم إلى 90 يومًا
 * (https://support.google.com/google-ads/answer/3123169). يبقى غير المعرِّف وحده: `utm_*` وصفحة الهبوط.
 */
export const TRACKING_RETENTION_DAYS = 90;
const MS_PER_DAY = 86_400_000;

/** ما أُنشئ قبل هذا الوقت يُفرَّغ. */
export function retentionCutoff(now: Date): Date {
  return new Date(now.getTime() - TRACKING_RETENTION_DAYS * MS_PER_DAY);
}
