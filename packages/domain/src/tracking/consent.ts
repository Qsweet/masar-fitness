import { providerCategories, type ConsentCategory, type TrackingProvider } from "./providers";

/**
 * موافقة الزائر (ADMIN_A5_TRACKING §3). نسخة النص داخل القيمة: تغيير نص الشريط برفع
 * `CONSENT_VERSION` يجعل كل موافقة سابقة غير صالحة فيُسأل الزائر من جديد.
 */
export const CONSENT_VERSION = 1;
export const CONSENT_COOKIE = "masar_consent";
/** 180 يومًا بالثواني. */
export const CONSENT_MAX_AGE_SECONDS = 15_552_000;

export interface Consent {
  readonly analytics: boolean;
  readonly ads: boolean;
  readonly version: number;
  /** وقت الاختيار بثواني يونكس. */
  readonly at: number;
}

const COOKIE_SHAPE = /^v(\d{1,3})\.a([01])\.m([01])\.(\d{1,12})$/;

export function encodeConsent(consent: Consent): string {
  const bit = (value: boolean) => (value ? "1" : "0");
  return `v${String(consent.version)}.a${bit(consent.analytics)}.m${bit(consent.ads)}.${String(consent.at)}`;
}

/** null لقيمة غائبة أو مشوّهة أو بنسخة نص قديمة: الزائر لم يوافق على النص الحالي. */
export function parseConsent(raw: string | undefined | null): Consent | null {
  const match = COOKIE_SHAPE.exec(raw ?? "");
  if (match === null) {
    return null;
  }
  const [, version = "", analytics, ads, at = ""] = match;
  if (Number(version) !== CONSENT_VERSION) {
    return null;
  }
  return {
    version: CONSENT_VERSION,
    analytics: analytics === "1",
    ads: ads === "1",
    at: Number(at),
  };
}

export function grants(consent: Consent | null, category: ConsentCategory): boolean {
  if (consent === null) {
    return false;
  }
  return category === "analytics" ? consent.analytics : consent.ads;
}

/** وسم المنصة يُحمَّل إن وافق الزائر على كل فئاتها (GTM: التحليلات والإعلانات معًا). */
export function consentAllows(provider: TrackingProvider, consent: Consent | null): boolean {
  return providerCategories(provider).every((category) => grants(consent, category));
}

export type GoogleConsentValue = "granted" | "denied";

export interface GoogleConsentState {
  readonly ad_storage: GoogleConsentValue;
  readonly ad_user_data: GoogleConsentValue;
  readonly ad_personalization: GoogleConsentValue;
  readonly analytics_storage: GoogleConsentValue;
}

/** الافتراضي قبل أي تحديث: كله مرفوض (Consent Mode v2). */
export const GOOGLE_CONSENT_DEFAULT: GoogleConsentState = {
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  analytics_storage: "denied",
};

/** حالة Consent Mode من موافقتنا: الإعلانات تفتح الثلاثة الإعلانية، والتحليلات التخزين التحليلي. */
export function googleConsentState(consent: Consent | null): GoogleConsentState {
  const value = (granted: boolean): GoogleConsentValue => (granted ? "granted" : "denied");
  const ads = value(grants(consent, "ads"));
  return {
    ad_storage: ads,
    ad_user_data: ads,
    ad_personalization: ads,
    analytics_storage: value(grants(consent, "analytics")),
  };
}
