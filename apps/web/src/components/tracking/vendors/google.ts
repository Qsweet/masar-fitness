/**
 * Google: gtag.js لـGA4 وGoogle Ads، وحاوية GTM، على `dataLayer` واحد (ADMIN_A5_TRACKING §2، §3.2).
 * Consent Mode v2: `default` كله مرفوض قبل أي أمر قياس، ثم `update` بما وافق عليه الزائر
 * (https://developers.google.com/tag-platform/security/guides/consent). لا يُحمَّل شيء قبل الموافقة.
 */
import {
  GOOGLE_CONSENT_DEFAULT,
  googleConsentState,
  sendsHashedPhone,
  type Consent,
  type IntegrationConfig,
} from "@masar/domain";
import type { Sink, TrackCall } from "../types";
import { injectScript } from "./globals";

const GTM_HOST = "https://www.googletagmanager.com";

let defaulted = false;

/**
 * `gtag` تعرّفه شيفرة Google الرسمية في HTML الخادم (`GoogleStub`): gtag.js يقرأ كائن `arguments`
 * نفسه لا مصفوفة. أول استعمال يضبط الافتراضي المرفوض قبل أي أمر قياس.
 */
function ensureGtag(): ((...args: unknown[]) => void) | null {
  const { gtag } = window;
  if (gtag === undefined) {
    return null;
  }
  if (!defaulted) {
    gtag("consent", "default", GOOGLE_CONSENT_DEFAULT);
    defaulted = true;
  }
  return gtag;
}

export function updateGoogleConsent(consent: Consent | null): void {
  if (window.gtag !== undefined) {
    window.gtag("consent", "update", googleConsentState(consent));
  }
}

interface GoogleIds {
  readonly ga4: IntegrationConfig | null;
  readonly ads: IntegrationConfig | null;
}

/** gtag.js مرة واحدة لأول معرّف، ثم `config` لكل معرّف (القياس والإعلانات). */
export function loadGtag(
  ids: GoogleIds,
  consent: Consent | null,
  nonce: string | undefined,
): Sink | null {
  const gtag = ensureGtag();
  if (gtag === null) {
    return null;
  }
  gtag("consent", "update", googleConsentState(consent));
  gtag("js", new Date());
  const measurementId = ids.ga4?.measurementId;
  const conversionId = ids.ads?.conversionId;
  const first = measurementId ?? conversionId;
  if (first !== undefined) {
    injectScript(`${GTM_HOST}/gtag/js?id=${encodeURIComponent(first)}`, nonce);
  }
  if (measurementId !== undefined) {
    // الصفحات تُرسل بأنفسنا مع كل تنقل (تطبيق صفحة واحدة)، فلا إرسال تلقائي مكرر
    gtag("config", measurementId, { send_page_view: false });
  }
  if (conversionId !== undefined) {
    gtag("config", conversionId);
  }
  return {
    send: (call) => {
      sendGtag(window.gtag ?? gtag, call, ids, measurementId !== undefined);
    },
  };
}

function items(call: TrackCall) {
  return (call.payload.lines ?? []).map((line) => ({
    item_id: line.id,
    item_name: line.name,
    price: line.price,
    quantity: 1,
  }));
}

function sendGtag(
  gtag: (...args: unknown[]) => void,
  call: TrackCall,
  ids: GoogleIds,
  analytics: boolean,
): void {
  const { payload } = call;
  if (analytics) {
    gtag("event", call.event, {
      value: payload.value,
      currency: payload.currency,
      items: items(call),
      transaction_id: payload.transactionId,
      interest: payload.interest,
    });
  }
  const ads = ids.ads ?? {};
  const { conversionId, conversionLabel } = ads;
  if (call.event === "purchase" && conversionId !== undefined && conversionLabel !== undefined) {
    if (payload.sha256Phone !== undefined && sendsHashedPhone("google_ads", ads)) {
      gtag("set", "user_data", { sha256_phone_number: payload.sha256Phone });
    }
    gtag("event", "conversion", {
      send_to: `${conversionId}/${conversionLabel}`,
      value: payload.value,
      currency: payload.currency,
      transaction_id: payload.transactionId,
    });
  }
}

/** الحاوية بشيفرتها الرسمية (‎gtm.start ثم gtm.js)، وأحداثنا بصيغة التجارة في GA4 على `dataLayer`. */
export function loadGtm(
  config: IntegrationConfig,
  consent: Consent | null,
  nonce: string | undefined,
): Sink | null {
  const { containerId } = config;
  const gtag = ensureGtag();
  if (containerId === undefined || gtag === null) {
    return null;
  }
  gtag("consent", "update", googleConsentState(consent));
  window.dataLayer?.push({ "gtm.start": Date.now(), event: "gtm.js" });
  injectScript(`${GTM_HOST}/gtm.js?id=${encodeURIComponent(containerId)}`, nonce);
  return {
    send: (call) => {
      window.dataLayer?.push({ ecommerce: null });
      window.dataLayer?.push({
        event: call.event,
        event_id: call.payload.eventId,
        ecommerce: {
          value: call.payload.value,
          currency: call.payload.currency,
          transaction_id: call.payload.transactionId,
          items: items(call),
        },
      });
    },
  };
}
