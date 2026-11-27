import type { SiteProvider } from "./site-config";

export interface PhoneShareInput {
  /** موافقة هذا الطلب (الكوكي الآن) على الإعلانات. */
  readonly requestAds: boolean;
  /** موافقة صاحب الطلب على الإعلانات لحظة الشراء (`order_tracking`). */
  readonly orderAds: boolean;
  readonly providers: readonly SiteProvider[];
}

/**
 * هل تحمل صفحة الطلب الجوال المجزّأ إلى المتصفح (القرار 89-1)؟ فقط لمنصة تستعمله في المتصفح (Google Ads
 * بتسمية تحويل، أو TikTok)، وبموافقة الإعلانات الآن ولحظة الشراء معًا. وبعدها شرط «أول عرض» في القاعدة.
 * غير ذلك يكفي المسار الخادمي.
 */
export function mayShareHashedPhone(input: PhoneShareInput): boolean {
  const usesPhone = input.providers.some(
    (item) =>
      item.provider === "tiktok" ||
      (item.provider === "google_ads" && item.config.conversionLabel !== undefined),
  );
  return input.requestAds && input.orderAds && usesPhone;
}
