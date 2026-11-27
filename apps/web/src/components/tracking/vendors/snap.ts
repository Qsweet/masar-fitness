/**
 * Snap Pixel بطابور `snaptr` كما في قالب Snap الرسمي (github.com/Snapchat/snapchat-google-tag-manager)،
 * و`client_dedup_id` = معرّف حدثنا، و`transaction_id` = مرجع الطلب (يطابق `order_id` في الخادم).
 */
import { pixelEventName, type IntegrationConfig } from "@masar/domain";
import type { Sink, TrackCall } from "../types";
import { injectScript, type SnapStub } from "./globals";

const SCRIPT = "https://sc-static.net/scevent.min.js";

function createStub(): SnapStub {
  const queue: unknown[] = [];
  const stub = ((...args: unknown[]) => {
    if (stub.handleRequest === undefined) {
      queue.push(args);
    } else {
      stub.handleRequest(...args);
    }
  }) as SnapStub;
  stub.queue = queue;
  return stub;
}

function eventData(call: TrackCall) {
  const { payload } = call;
  return {
    price: payload.value,
    currency: payload.currency,
    item_ids: (payload.lines ?? []).map((line) => line.id),
    transaction_id: payload.transactionId,
    client_dedup_id: payload.eventId,
  };
}

export function loadSnap(config: IntegrationConfig, nonce: string | undefined): Sink | null {
  const { pixelId } = config;
  if (pixelId === undefined) {
    return null;
  }
  if (window.snaptr === undefined) {
    window.snaptr = createStub();
    injectScript(SCRIPT, nonce);
  }
  const snaptr = window.snaptr;
  snaptr("init", pixelId, {});
  return {
    send: (call) => {
      snaptr("track", pixelEventName("snap", call.event), eventData(call));
    },
  };
}
