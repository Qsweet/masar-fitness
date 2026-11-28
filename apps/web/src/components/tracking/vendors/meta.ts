/**
 * Meta Pixel بشيفرته الأساسية الرسمية (طابور `fbq` ثم `fbevents.js`)، والحدث بـ`eventID` الذي تطابقه
 * Conversions API (https://developers.facebook.com/documentation/ads-commerce/conversions-api/deduplicate-pixel-and-server-events).
 */
import { pixelEventName, type IntegrationConfig } from "@masar/domain";
import type { Sink, TrackCall } from "../types";
import { injectScript, type MetaStub } from "./globals";

const SCRIPT = "https://connect.facebook.net/en_US/fbevents.js";

function createStub(): MetaStub {
  const queue: unknown[] = [];
  const stub = ((...args: unknown[]) => {
    if (stub.callMethod === undefined) {
      queue.push(args);
    } else {
      stub.callMethod(...args);
    }
  }) as MetaStub;
  stub.queue = queue;
  stub.push = stub;
  stub.loaded = true;
  stub.version = "2.0";
  return stub;
}

function eventData(call: TrackCall) {
  const lines = call.payload.lines ?? [];
  return {
    value: call.payload.value,
    currency: call.payload.currency,
    content_type: "product",
    content_ids: lines.map((line) => line.id),
    contents: lines.map((line) => ({ id: line.id, quantity: 1 })),
  };
}

export function loadMeta(config: IntegrationConfig, nonce: string | undefined): Sink | null {
  const { pixelId } = config;
  if (pixelId === undefined) {
    return null;
  }
  if (window.fbq === undefined) {
    const stub = createStub();
    window.fbq = stub;
    window._fbq ??= stub;
    injectScript(SCRIPT, nonce);
  }
  const fbq = window.fbq;
  fbq("init", pixelId);
  return {
    send: (call) => {
      const options = { eventID: call.payload.eventId };
      // الدالة تُقرأ من window عند كل حدث: سكربت المنصة قد يستبدل الطابور بعد تحميله
      (window.fbq ?? fbq)("track", pixelEventName("meta", call.event), eventData(call), options);
    },
  };
}
