/**
 * X Pixel بطابور `twq` كما تنشئه شيفرة X الأساسية وقالباها الرسميان لـGTM
 * (github.com/twitter/google-tag-manager-base-tag و…-event-tag): `twq('config', <البكسل>)` ثم
 * `twq('event', <معرّف الحدث>, {…})`. لكل حدث معرّف يُنشأ في Ads Manager، فما لم يُضبط لا يُرسل.
 * المزايا الآلية في uwt.js تُطفأ قبل الإعداد بأوامره نفسها (`set … 'false'`): مسح حقول النماذج
 * (`autoAdvancedMatching`)، وقراءة `dataLayer` (`dataLayerTracking`)، والإعداد الآلي، وقياس المكوث؛
 * فلا يصل X إلا ما نرسله، ويبقى نص نموذج الاستفسار «لا يُرسل لطرف ثالث» صادقًا.
 */
import { sendsHashedPhone, type IntegrationConfig } from "@masar/domain";
import type { Sink, TrackCall } from "../types";
import { devWarning } from "../dev-warning";
import { injectScript, type XStub } from "./globals";

const SCRIPT = "https://static.ads-twitter.com/uwt.js";
const STUB_VERSION = "1.1";
const DUPLICATE_BASE_TAG =
  "X Pixel: twq existed before our base code. Remove the X base tag from the GTM container.";
const AUTOMATIC = ["autoConfig", "autoAdvancedMatching", "dataLayerTracking", "autoDwellTracking"];

function createStub(): XStub {
  const queue: unknown[] = [];
  const stub = ((...args: unknown[]) => {
    if (stub.exe === undefined) {
      queue.push(args);
    } else {
      stub.exe(...args);
    }
  }) as XStub;
  stub.queue = queue;
  stub.version = STUB_VERSION;
  return stub;
}

function contents(call: TrackCall) {
  return (call.payload.lines ?? []).map((line) => ({
    content_id: line.id,
    content_name: line.name,
    content_price: line.price,
    num_items: 1,
  }));
}

function purchaseData(call: TrackCall, config: IntegrationConfig) {
  const { payload } = call;
  const phone = sendsHashedPhone("x", config) ? payload.sha256Phone : undefined;
  return {
    value: payload.value,
    currency: payload.currency,
    conversion_id: payload.eventId,
    contents: contents(call),
    ...(phone === undefined ? {} : { phone_number: phone }),
    ...(payload.twclid === undefined ? {} : { twclid: payload.twclid }),
  };
}

/** معرّف حدث X لحدثنا، وبياناته. الاستفسار بلا بيانات: اسم الحدث وحده. */
function eventOf(call: TrackCall, config: IntegrationConfig) {
  switch (call.event) {
    case "purchase":
      return { id: config.purchaseEventId, data: purchaseData(call, config) };
    case "add_to_cart":
      return {
        id: config.addToCartEventId,
        data: {
          value: call.payload.value,
          currency: call.payload.currency,
          contents: contents(call),
        },
      };
    case "generate_lead":
      return { id: config.leadEventId, data: {} };
    case "page_view":
    case "view_item":
    case "begin_checkout":
      return { id: undefined, data: {} };
  }
}

export function loadX(config: IntegrationConfig, nonce: string | undefined): Sink | null {
  const { pixelId } = config;
  if (pixelId === undefined) {
    return null;
  }
  if (window.twq === undefined) {
    window.twq = createStub();
    injectScript(SCRIPT, nonce);
  } else {
    // وسم X آخر سبقنا (داخل حاوية GTM غالبًا): أوامرنا تُطبَّق عليه، والتكرار يُصلَح بإزالته من الحاوية
    devWarning(DUPLICATE_BASE_TAG);
  }
  const twq = window.twq;
  for (const feature of AUTOMATIC) {
    twq("set", feature, "false", pixelId);
  }
  twq("config", pixelId);
  // `config` يقيس زيارة الصفحة الأولى؛ كل تنقل بعدها `config` جديد كما تفعل وسوم GTM عند تغيّر المسار
  let firstPage = true;
  return {
    send: (call) => {
      // الدالة تُقرأ من window عند كل حدث: سكربت المنصة قد يستبدل الطابور بعد تحميله
      const current = window.twq ?? twq;
      if (call.event === "page_view") {
        if (!firstPage) {
          current("config", pixelId);
        }
        firstPage = false;
        return;
      }
      const event = eventOf(call, config);
      if (event.id !== undefined) {
        current("event", event.id, event.data);
      }
    },
  };
}
