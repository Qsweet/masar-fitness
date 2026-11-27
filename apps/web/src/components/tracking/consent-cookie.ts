import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE_SECONDS,
  CONSENT_VERSION,
  encodeConsent,
  parseConsent,
  type Consent,
} from "@masar/domain";

/** حدث المتصفح حين يتغير الاختيار، وحين يطلب رابط التذييل فتح الشريط. */
export const CONSENT_CHANGED = "masar:consent-changed";
export const CONSENT_OPEN = "masar:consent-open";
const MS_PER_SECOND = 1000;

export function readConsent(): Consent | null {
  const prefix = `${CONSENT_COOKIE}=`;
  const raw = document.cookie
    .split("; ")
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
  return parseConsent(raw);
}

/** يحفظ الاختيار في كوكي طرف أول (يقرؤه الخادم عند الطلب) ويعلن التغيير. */
export function saveConsent(choice: {
  readonly analytics: boolean;
  readonly ads: boolean;
}): Consent {
  const consent: Consent = {
    ...choice,
    version: CONSENT_VERSION,
    at: Math.floor(Date.now() / MS_PER_SECOND),
  };
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${encodeConsent(consent)}; Path=/; Max-Age=${String(CONSENT_MAX_AGE_SECONDS)}; SameSite=Lax${secure}`;
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGED));
  return consent;
}

export function openConsentSettings(): void {
  window.dispatchEvent(new CustomEvent(CONSENT_OPEN));
}
