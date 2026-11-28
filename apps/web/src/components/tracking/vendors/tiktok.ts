/**
 * TikTok Pixel بطابور `ttq` كما تنشره شيفرة TikTok الأساسية في Events Manager (يُطابقها المالك عند
 * الإعداد، ADMIN_A5_TRACKING §1)، و`event_id` في الوسيط الثالث لـ`ttq.track` كما في قالب TikTok الرسمي
 * (github.com/tiktok/gtm-template-pixel).
 */
import { pixelEventName, sendsHashedPhone, type IntegrationConfig } from "@masar/domain";
import type { Sink, TrackCall } from "../types";
import { injectScript, type TiktokStub } from "./globals";

const SCRIPT = "https://analytics.tiktok.com/i18n/pixel/events.js";
const GLOBAL_NAME = "ttq";
const METHODS = [
  "page",
  "track",
  "identify",
  "instances",
  "debug",
  "on",
  "off",
  "once",
  "ready",
  "alias",
  "group",
  "enableCookie",
  "disableCookie",
  "holdConsent",
  "revokeConsent",
  "grantConsent",
] as const;

function createStub(nonce: string | undefined): TiktokStub {
  const ttq = [] as unknown as TiktokStub;
  const record = ttq as unknown as Record<string, unknown>;
  ttq.methods = METHODS;
  for (const method of METHODS) {
    record[method] = (...args: unknown[]) => {
      ttq.push([method, ...args]);
    };
  }
  ttq.load = (pixelId: string) => {
    ttq._i ??= {};
    ttq._i[pixelId] = Object.assign([], { _u: SCRIPT });
    ttq._t ??= {};
    ttq._t[pixelId] = Date.now();
    ttq._o ??= {};
    ttq._o[pixelId] = {};
    injectScript(`${SCRIPT}?sdkid=${encodeURIComponent(pixelId)}&lib=${GLOBAL_NAME}`, nonce);
  };
  return ttq;
}

function eventData(call: TrackCall) {
  const { payload } = call;
  return {
    value: payload.value,
    currency: payload.currency,
    content_type: "product",
    contents: (payload.lines ?? []).map((line) => ({
      content_id: line.id,
      content_name: line.name,
      price: line.price,
      quantity: 1,
    })),
  };
}

export function loadTiktok(config: IntegrationConfig, nonce: string | undefined): Sink | null {
  const { pixelId } = config;
  if (pixelId === undefined) {
    return null;
  }
  if (window.ttq === undefined) {
    window.TiktokAnalyticsObject = GLOBAL_NAME;
    window.ttq = createStub(nonce);
    window.ttq.load(pixelId);
  }
  const loaded = window.ttq;
  return {
    send: (call) => {
      // الدالة تُقرأ من window عند كل حدث: سكربت المنصة قد يستبدل الطابور بعد تحميله
      const ttq = window.ttq ?? loaded;
      if (call.event === "page_view") {
        ttq.page();
        return;
      }
      if (call.payload.sha256Phone !== undefined && sendsHashedPhone("tiktok", config)) {
        ttq.identify({ sha256_phone_number: call.payload.sha256Phone });
      }
      ttq.track(pixelEventName("tiktok", call.event), eventData(call), {
        event_id: call.payload.eventId,
      });
    },
  };
}
