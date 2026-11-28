/**
 * Measurement Pixel لإعلانات ChatGPT (القرار 91)، من الوثيقة الرسمية
 * https://developers.openai.com/ads/measurement-pixel و https://developers.openai.com/ads/supported-events:
 * `oaiq` يعرّفه `OpenaiStub` بشيفرة OpenAI نفسها، ثم يُحمَّل `oaiq.min.js` بالـnonce بعد موافقة الإعلانات،
 * و`oaiq("consent", true)` قبل `init` (الوثيقة: «Set consent before initializing the Pixel»). لا كائن
 * `user` من المتصفح: الجوال المجزّأ يصل OpenAI من الخادم وحده. المبالغ بالهللة عددًا صحيحًا كما يكتبها
 * الخادم، والشراء بـ`event_id` = ‎purchase.<order_id>‎ فيطابق Conversions API ويُسقط المكرر.
 */
import { pixelEventName, type Consent, type IntegrationConfig } from "@masar/domain";
import type { Sink, TrackCall } from "../types";
import { injectScript } from "./globals";

const SCRIPT = "https://bzrcdn.openai.com/sdk/oaiq.min.js";

let injected = false;

function oaiqOf(): ((...args: unknown[]) => void) | null {
  return window.oaiq ?? null;
}

function contents(call: TrackCall) {
  const currency = call.payload.currency;
  return (call.payload.lines ?? []).map((line) => ({
    id: line.id,
    name: line.name,
    content_type: "product",
    quantity: 1,
    amount: line.priceMinor,
    currency,
  }));
}

/** بيانات الحدث بشكله الموثَّق: `contents` للصفحة والمنتج والسلة والشراء، و`customer_action` للاستفسار. */
function eventData(call: TrackCall) {
  if (call.event === "generate_lead") {
    return { type: "customer_action" };
  }
  if (call.event === "page_view") {
    return { type: "contents" };
  }
  const { valueMinor, currency } = call.payload;
  return {
    type: "contents",
    ...(valueMinor === undefined || currency === undefined ? {} : { amount: valueMinor, currency }),
    contents: contents(call),
  };
}

export function loadOpenai(config: IntegrationConfig, nonce: string | undefined): Sink | null {
  const { pixelId } = config;
  const oaiq = oaiqOf();
  if (pixelId === undefined || oaiq === null) {
    return null;
  }
  if (!injected) {
    injectScript(SCRIPT, nonce);
    injected = true;
  }
  oaiq("consent", true);
  oaiq("init", { pixelId });
  return {
    send: (call) => {
      const options = { event_id: call.payload.eventId };
      oaiq("measure", pixelEventName("openai", call.event), eventData(call), options);
    },
  };
}

/** سحب الإعلانات قبل إعادة التحميل: `consent false` يوقف الإرسال ويمحو `__oppref` و`__obref` (الوثيقة). */
export function withdrawOpenaiConsent(consent: Consent): void {
  const oaiq = oaiqOf();
  if (!consent.ads && oaiq !== null) {
    oaiq("consent", false);
  }
}
