/**
 * TikTok Events API 2.0 (ADMIN_A5_TRACKING §4.3): البنية من قالب TikTok الرسمي
 * https://github.com/tiktok/gtm-template-eapi و https://business-api.tiktok.com/portal/docs/events-api-2.0/v1.3
 * الرد 200 دائمًا تقريبًا، والنجاح `code = 0` في الجسم.
 */
import { majorNumber, vendorCookie } from "@masar/domain";
import {
  compact,
  hashedExternalId,
  hashedPhoneE164,
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

export const TIKTOK_ENDPOINT = "https://business-api.tiktok.com/open_api/v1.3/event/track/";
/** حدث قياسي مع رمز الاختبار: تيك توك لا تحفظ الحدث الحي الذي يحمل الرمز. */
export const TIKTOK_TEST_EVENT = "ViewContent";

function headers(secret: string) {
  return { "Access-Token": secret };
}

function user(input: PurchaseInput) {
  const { purchase } = input;
  return compact({
    phone: hashedPhoneE164(purchase),
    external_id: hashedExternalId(purchase),
    ttclid: touchValue(purchase, "ttclid")?.value ?? null,
    ttp: vendorCookie(purchase.ttp ?? undefined),
    ip: purchase.clientIp,
    user_agent: purchase.userAgent,
  });
}

export function buildTiktokPurchase(input: PurchaseInput): Built {
  const { purchase, config, secret, eventId } = input;
  if (config.pixelId === undefined) {
    return skip("config_incomplete");
  }
  const event = {
    event: "CompletePayment",
    event_time: unixSeconds(purchase.paidAt),
    event_id: eventId,
    page: { url: sourceUrl(purchase, input.siteUrl) },
    user: user(input),
    properties: {
      currency: purchase.currency,
      value: majorNumber(purchase.totalMinor),
      order_id: purchase.reference,
      content_type: "product",
      contents: linesOf(purchase).map((line) => ({
        content_id: line.id,
        content_name: line.name,
        price: line.price,
        quantity: 1,
      })),
    },
  };
  const body = { event_source: "web", event_source_id: config.pixelId, data: [event] };
  return jsonRequest(TIKTOK_ENDPOINT, body, "CompletePayment", headers(secret));
}

export function buildTiktokTest(input: TestInput): Built {
  if (input.config.pixelId === undefined) {
    return skip("config_incomplete");
  }
  if (input.testEventCode === null) {
    return skip("no_test_event_code");
  }
  const event = {
    event: TIKTOK_TEST_EVENT,
    event_time: unixSeconds(input.now),
    event_id: input.eventId,
    page: { url: input.siteUrl },
    user: { user_agent: "masar-admin-test" },
  };
  const body = {
    event_source: "web",
    event_source_id: input.config.pixelId,
    test_event_code: input.testEventCode,
    data: [event],
  };
  return jsonRequest(TIKTOK_ENDPOINT, body, TIKTOK_TEST_EVENT, headers(input.secret));
}

/** `code` غير الصفر في الجسم خطأ واجهة (`api_<code>`). */
export function tiktokCodeError(body: string): string | null {
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed === "object" && parsed !== null && "code" in parsed) {
      const { code } = parsed;
      return typeof code === "number" && code !== 0
        ? `api_${String(Math.abs(Math.trunc(code)))}`
        : null;
    }
    return null;
  } catch {
    return null;
  }
}
