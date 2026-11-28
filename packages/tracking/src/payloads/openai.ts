/**
 * Conversions API لإعلانات ChatGPT (OpenAI)، القرار 91. كل حقل من الوثائق الرسمية:
 * https://developers.openai.com/ads/conversions-api
 * https://developers.openai.com/ads/conversion-tracking
 * https://developers.openai.com/ads/supported-events
 * `POST https://bzr.openai.com/v1/events?pid=<PIXEL-ID>` بترويسة `Authorization: Bearer <API-KEY>`.
 * المبالغ عدد صحيح بالوحدة الصغرى للعملة (الهللة للريال) كما نحفظها، فلا تحويل. الاختبار
 * `validate_only: true`: يتحقق من الطلب ولا يحفظ الحدث.
 */
import { vendorCookie } from "@masar/domain";
import {
  compact,
  hashedExternalId,
  hashedPhoneDigits,
  jsonRequest,
  skip,
  sourceUrl,
  touchValue,
  type Built,
  type PurchaseInput,
  type TestInput,
} from "./common";

export const OPENAI_EVENTS_URL = "https://bzr.openai.com/v1/events";
export const OPENAI_PURCHASE_EVENT = "order_created";
/** حدث الاختبار: مشاهدة صفحة، بلا بيانات عميل، وبالتحقق وحده فلا يُحفظ. */
export const OPENAI_TEST_EVENT = "page_viewed";

function endpoint(pixelId: string): string {
  return `${OPENAI_EVENTS_URL}?${new URLSearchParams({ pid: pixelId }).toString()}`;
}

function headers(secret: string) {
  return { Authorization: `Bearer ${secret}` };
}

/** `user` لكل حدث: قوائم مجزّأة (حد ثلاث قيم) و`obref` والعنوان والوكيل بلا تجزئة. */
function user(input: PurchaseInput) {
  const { purchase } = input;
  const phone = hashedPhoneDigits("openai", input);
  return compact({
    obref: vendorCookie(purchase.obref ?? undefined),
    phone_numbers_sha256: phone === null ? null : [phone],
    external_ids_sha256: [hashedExternalId(purchase)],
    ip_address: purchase.clientIp,
    user_agent: purchase.userAgent,
  });
}

function contentsOf(input: PurchaseInput) {
  const { purchase } = input;
  return purchase.items.map((item) => ({
    id: item.slug,
    name: purchase.locale === "en" ? item.nameEn : item.nameAr,
    content_type: "product",
    quantity: 1,
    amount: item.totalMinor,
    currency: purchase.currency,
  }));
}

export function buildOpenaiPurchase(input: PurchaseInput): Built {
  const { purchase, config, secret, eventId } = input;
  if (config.pixelId === undefined) {
    return skip("config_incomplete");
  }
  const event = compact({
    id: eventId,
    type: OPENAI_PURCHASE_EVENT,
    timestamp_ms: purchase.paidAt.getTime(),
    // من الرابط المختوم، وإلا كوكي البكسل `__oppref` (مراجعة القرار 91): القيمة كما هي بلا تعديل
    oppref: touchValue(purchase, "oppref")?.value ?? purchase.opprefCookie,
    source_url: sourceUrl(purchase, input.siteUrl),
    action_source: "web",
    user: user(input),
    data: {
      type: "contents",
      amount: purchase.totalMinor,
      currency: purchase.currency,
      contents: contentsOf(input),
    },
  });
  const body = { validate_only: false, events: [event] };
  return jsonRequest(endpoint(config.pixelId), body, OPENAI_PURCHASE_EVENT, headers(secret));
}

export function buildOpenaiTest(input: TestInput): Built {
  if (input.config.pixelId === undefined) {
    return skip("config_incomplete");
  }
  const event = {
    id: input.eventId,
    type: OPENAI_TEST_EVENT,
    timestamp_ms: input.now.getTime(),
    source_url: input.siteUrl,
    action_source: "web",
    data: { type: "contents" },
  };
  const body = { validate_only: true, events: [event] };
  return jsonRequest(
    endpoint(input.config.pixelId),
    body,
    OPENAI_TEST_EVENT,
    headers(input.secret),
  );
}
