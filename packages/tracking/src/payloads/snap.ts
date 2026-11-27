/**
 * Snap Conversions API v3 (ADMIN_A5_TRACKING §4.3):
 * https://developers.snap.com/api/marketing-api/Conversions-API/UsingTheAPI
 * https://developers.snap.com/api/marketing-api/Conversions-API/Parameters
 * الاختبار على `/events/validate`: يتحقق من البناء ولا يُحتسب حدثًا.
 */
import { majorNumber, vendorCookie } from "@masar/domain";
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

export const SNAP_TEST_EVENT = "PAGE_VIEW";
/** عنوان من مدى التوثيق (RFC 5737): حدث الاختبار يحتاج عنوانًا ووكيلًا للمطابقة، ولا زائر حقيقي. */
const TEST_IP = "192.0.2.1";

function endpoint(pixelId: string, secret: string, validate: boolean): string {
  const query = new URLSearchParams({ access_token: secret });
  const path = validate ? "events/validate" : "events";
  return `https://tr.snapchat.com/v3/${pixelId}/${path}?${query.toString()}`;
}

function userData(input: PurchaseInput) {
  const { purchase } = input;
  const phone = hashedPhoneDigits(purchase);
  return compact({
    ph: phone === null ? null : [phone],
    external_id: hashedExternalId(purchase),
    client_ip_address: purchase.clientIp,
    client_user_agent: purchase.userAgent,
    sc_click_id: touchValue(purchase, "ScCid")?.value ?? null,
    sc_cookie1: vendorCookie(purchase.scid ?? undefined),
  });
}

export function buildSnapPurchase(input: PurchaseInput): Built {
  const { purchase, config, secret, eventId } = input;
  if (config.pixelId === undefined) {
    return skip("config_incomplete");
  }
  const lines = linesOf(purchase);
  const event = {
    event_name: "PURCHASE",
    event_time: unixSeconds(purchase.paidAt),
    event_id: eventId,
    action_source: "WEB",
    event_source_url: sourceUrl(purchase, input.siteUrl),
    user_data: userData(input),
    custom_data: {
      currency: purchase.currency,
      value: majorNumber(purchase.totalMinor),
      order_id: purchase.reference,
      content_ids: lines.map((line) => line.id),
      num_items: String(lines.length),
    },
  };
  return jsonRequest(endpoint(config.pixelId, secret, false), { data: [event] }, "PURCHASE");
}

export function buildSnapTest(input: TestInput): Built {
  if (input.config.pixelId === undefined) {
    return skip("config_incomplete");
  }
  const event = {
    event_name: SNAP_TEST_EVENT,
    event_time: unixSeconds(input.now),
    event_id: input.eventId,
    action_source: "WEB",
    event_source_url: input.siteUrl,
    user_data: { client_ip_address: TEST_IP, client_user_agent: "masar-admin-test" },
  };
  return jsonRequest(
    endpoint(input.config.pixelId, input.secret, true),
    { data: [event] },
    SNAP_TEST_EVENT,
  );
}

/** رد سناب `{status: "VALID"}`؛ حالة أخرى خطأ حتى لو كان الرمز 200. */
export function snapStatusError(body: string): string | null {
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed === "object" && parsed !== null && "status" in parsed) {
      return parsed.status === "VALID" ? null : "api_invalid";
    }
    return null;
  } catch {
    return null;
  }
}
