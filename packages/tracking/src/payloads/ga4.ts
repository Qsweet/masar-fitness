/**
 * GA4 Measurement Protocol (ADMIN_A5_TRACKING §4.3):
 * https://developers.google.com/analytics/devguides/collection/protocol/ga4/sending-events
 * `client_id` من كوكي `_ga` شرط: بلا معرّف عميل لا يُربط الحدث بزيارة، فلا يُرسل.
 */
import { majorNumber } from "@masar/domain";
import {
  jsonRequest,
  linesOf,
  skip,
  type Built,
  type PurchaseInput,
  type TestInput,
} from "./common";

const HOST = "https://www.google-analytics.com";
const MICROS_PER_MS = 1000;
export const GA4_TEST_EVENT = "masar_test_event";
/** معرّف عميل ثابت لحدث الاختبار: نقطة التحقق لا تسجّل شيئًا في التقارير. */
const TEST_CLIENT_ID = "1000000000.1000000000";

function endpoint(path: string, measurementId: string, secret: string): string {
  const query = new URLSearchParams({ measurement_id: measurementId, api_secret: secret });
  return `${HOST}${path}?${query.toString()}`;
}

export function buildGa4Purchase(input: PurchaseInput): Built {
  const { purchase, config, secret } = input;
  if (config.measurementId === undefined) {
    return skip("config_incomplete");
  }
  if (purchase.gaClientId === null) {
    return skip("no_client_id");
  }
  const ads = purchase.consentAds ? "GRANTED" : "DENIED";
  const body = {
    client_id: purchase.gaClientId,
    timestamp_micros: purchase.paidAt.getTime() * MICROS_PER_MS,
    consent: { ad_user_data: ads, ad_personalization: ads },
    events: [
      {
        name: "purchase",
        params: {
          transaction_id: purchase.reference,
          value: majorNumber(purchase.totalMinor),
          currency: purchase.currency,
          items: linesOf(purchase).map((line) => ({
            item_id: line.id,
            item_name: line.name,
            price: line.price,
            quantity: 1,
          })),
        },
      },
    ],
  };
  return jsonRequest(endpoint("/mp/collect", config.measurementId, secret), body, "purchase");
}

/** نقطة التحقق (`/debug/mp/collect`) لا تسجّل في التقارير وترد برسائل التحقق. */
export function buildGa4Test(input: TestInput): Built {
  if (input.config.measurementId === undefined) {
    return skip("config_incomplete");
  }
  const body = { client_id: TEST_CLIENT_ID, events: [{ name: GA4_TEST_EVENT, params: {} }] };
  return jsonRequest(
    endpoint("/debug/mp/collect", input.config.measurementId, input.secret),
    body,
    GA4_TEST_EVENT,
  );
}

/** رد نقطة التحقق: `validationMessages` غير فارغة ⇒ الحدث مرفوض. */
export function ga4ValidationError(body: string): string | null {
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed === "object" && parsed !== null && "validationMessages" in parsed) {
      const messages = parsed.validationMessages;
      return Array.isArray(messages) && messages.length > 0 ? "validation_failed" : null;
    }
    return null;
  } catch {
    return null;
  }
}
