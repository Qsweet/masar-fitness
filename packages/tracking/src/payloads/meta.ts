/**
 * Meta Conversions API (ADMIN_A5_TRACKING §4.3):
 * https://developers.facebook.com/documentation/ads-commerce/conversions-api/using-the-api
 * https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/customer-information-parameters
 * رمز الاختبار يُرسل مع حدث الاختبار وحده: ميتا تطلب إزالته من الحمولة الحية.
 */
import { fbcFromClickId, majorNumber, metaCookie } from "@masar/domain";
import { sha256Hex } from "../hash";
import {
  compact,
  hashedExternalId,
  hashedPhoneDigits,
  jsonRequest,
  linesOf,
  skip,
  sourceUrl,
  touchValue,
  unixSeconds,
  type Built,
  type PurchaseInput,
  type TestInput,
} from "./common";

export const META_GRAPH_VERSION = "v27.0";
/** حدث مخصّص: أحداث `test_event_code` لا تُسقط عند ميتا وتدخل القياس، فلا نختبر بـ`Purchase`. */
export const META_TEST_EVENT = "MasarTestEvent";
const MS_PER_SECOND = 1000;

function endpoint(pixelId: string, secret: string): string {
  const query = new URLSearchParams({ access_token: secret });
  return `https://graph.facebook.com/${META_GRAPH_VERSION}/${pixelId}/events?${query.toString()}`;
}

function fbcOf(input: PurchaseInput): string | null {
  const cookie = metaCookie(input.purchase.fbc ?? undefined);
  if (cookie !== null) {
    return cookie;
  }
  const click = touchValue(input.purchase, "fbclid");
  return click === null ? null : fbcFromClickId(click.value, click.at * MS_PER_SECOND);
}

function userData(input: PurchaseInput) {
  const { purchase } = input;
  const phone = hashedPhoneDigits("meta", input);
  return compact({
    ph: phone === null ? null : [phone],
    external_id: [hashedExternalId(purchase)],
    client_ip_address: purchase.clientIp,
    client_user_agent: purchase.userAgent,
    fbc: fbcOf(input),
    fbp: metaCookie(purchase.fbp ?? undefined),
  });
}

export function buildMetaPurchase(input: PurchaseInput): Built {
  const { purchase, config, secret, eventId } = input;
  if (config.pixelId === undefined) {
    return skip("config_incomplete");
  }
  const lines = linesOf(purchase);
  const event = {
    event_name: "Purchase",
    event_time: unixSeconds(purchase.paidAt),
    event_id: eventId,
    action_source: "website",
    event_source_url: sourceUrl(purchase, input.siteUrl),
    user_data: userData(input),
    custom_data: {
      currency: purchase.currency,
      value: majorNumber(purchase.totalMinor),
      order_id: purchase.reference,
      content_type: "product",
      content_ids: lines.map((line) => line.id),
      contents: lines.map((line) => ({ id: line.id, quantity: 1, item_price: line.price })),
    },
  };
  return jsonRequest(endpoint(config.pixelId, secret), { data: [event] }, "Purchase");
}

/** حدث الاختبار يشترط رمز الاختبار: بلا رمز يدخل حدثًا مخصّصًا بيانات الإنتاج. */
export function buildMetaTest(input: TestInput): Built {
  if (input.config.pixelId === undefined) {
    return skip("config_incomplete");
  }
  if (input.testEventCode === null) {
    return skip("no_test_event_code");
  }
  const event = {
    event_name: META_TEST_EVENT,
    event_time: unixSeconds(input.now),
    event_id: input.eventId,
    action_source: "website",
    event_source_url: input.siteUrl,
    user_data: { external_id: [sha256Hex(input.eventId)], client_user_agent: "masar-admin-test" },
  };
  const body = { data: [event], test_event_code: input.testEventCode };
  return jsonRequest(endpoint(input.config.pixelId, input.secret), body, META_TEST_EVENT);
}
