/**
 * منصات الربط والقياس (ADMIN_A5_TRACKING §0). الترتيب هو ترتيب العرض في اللوحة.
 * `gtm` حاوية تحمل وسومًا لأي فئة، فلا تُحمَّل إلا بموافقة الفئتين معًا (القرار 89-6)، وConsent Mode
 * ينقل لها الحالة لكل فئة؛ الباقي بفئته وحدها.
 */
export const TRACKING_PROVIDERS = ["gtm", "ga4", "google_ads", "meta", "snap", "tiktok"] as const;
export type TrackingProvider = (typeof TRACKING_PROVIDERS)[number];

/** ما له واجهة تحويلات خادمية منفَّذة (§4.3): Google Ads في المتصفح وحده، وGTM حاوية متصفح. */
export const SERVER_PROVIDERS = ["ga4", "meta", "snap", "tiktok"] as const;
export type ServerProvider = (typeof SERVER_PROVIDERS)[number];

export const CONSENT_CATEGORIES = ["analytics", "ads"] as const;
export type ConsentCategory = (typeof CONSENT_CATEGORIES)[number];

const CATEGORIES: Readonly<Record<TrackingProvider, readonly ConsentCategory[]>> = {
  gtm: ["analytics", "ads"],
  ga4: ["analytics"],
  google_ads: ["ads"],
  meta: ["ads"],
  snap: ["ads"],
  tiktok: ["ads"],
};

/** فئات المنصة: كلها شرط لتحميل وسمها (`gtm` فئتان، والبقية فئة واحدة). */
export function providerCategories(provider: TrackingProvider): readonly ConsentCategory[] {
  return CATEGORIES[provider];
}

export function isTrackingProvider(value: string): value is TrackingProvider {
  return (TRACKING_PROVIDERS as readonly string[]).includes(value);
}

export function isServerProvider(provider: TrackingProvider): provider is ServerProvider {
  return (SERVER_PROVIDERS as readonly string[]).includes(provider);
}
