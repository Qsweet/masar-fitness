import { sendsHashedPhone, type IntegrationConfig, type TrackingProvider } from "@masar/domain";
import type { SiteProvider } from "./site-config";

export interface BrowserShareInput {
  /** موافقة هذا الطلب (الكوكي الآن) على الإعلانات. */
  readonly requestAds: boolean;
  /** موافقة صاحب الطلب على الإعلانات لحظة الشراء (`order_tracking`). */
  readonly orderAds: boolean;
  readonly providers: readonly SiteProvider[];
}

export interface BrowserShare {
  /** الجوال المجزّأ: لمنصة تستعمله في المتصفح ولم يُطفئه المالك لها (القرار 90-3). */
  readonly phone: boolean;
  /** معرّف نقر X المختوم مع الطلب: لـX بحدث شراء (القرار 90-1). */
  readonly twclid: boolean;
}

/** المنصات التي تأخذ الجوال في المتصفح، بشرط إعدادها (Google Ads بتسمية، وX بحدث شراء). */
const BROWSER_PHONE: Partial<Record<TrackingProvider, (config: IntegrationConfig) => boolean>> = {
  tiktok: () => true,
  google_ads: (config) => config.conversionLabel !== undefined,
  x: (config) => config.purchaseEventId !== undefined,
};

function usesPhoneInBrowser(item: SiteProvider): boolean {
  return BROWSER_PHONE[item.provider]?.(item.config) === true;
}

/**
 * ما تحمله صفحة الطلب من معرّفات إلى المتصفح (القرار 89-1): فقط بموافقة الإعلانات الآن ولحظة الشراء
 * معًا، ولمنصة تستعملها في المتصفح. وبعدها شرط «أول عرض» في القاعدة. غير ذلك يكفي المسار الخادمي.
 */
export function browserShare(input: BrowserShareInput): BrowserShare {
  if (!input.requestAds || !input.orderAds) {
    return { phone: false, twclid: false };
  }
  const phone = input.providers.some(
    (item) => usesPhoneInBrowser(item) && sendsHashedPhone(item.provider, item.config),
  );
  const twclid = input.providers.some(
    (item) => item.provider === "x" && item.config.purchaseEventId !== undefined,
  );
  return { phone, twclid };
}
