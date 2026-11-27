import "server-only";
import { isServerProvider, isTrackingProvider } from "@masar/domain";
import {
  createFakeTransport,
  fetchTransport,
  sendTestEvent,
  type TrackingTransport,
} from "@masar/tracking";
import { getDb } from "../../db";
import { getEnv } from "../../env";
import { adminSecretKey } from "../flag";
import type { StaffContext } from "../session";
import { allowTrackingTest } from "../throttle";

/** الناقل الحقيقي، إلا `TRACKING_TRANSPORT=fake` (اختبارات المتصفح على عنوان الجهاز): لا شبكة. */
export function trackingTransport(): TrackingTransport {
  return getEnv().TRACKING_TRANSPORT === "fake"
    ? createFakeTransport().transport
    : fetchTransport(fetch);
}

const NOT_SENT_REASONS = new Set([
  "no_secret",
  "secret_unreadable",
  "no_test_event_code",
  "config_incomplete",
  "not_configured",
]);

/** «أرسل حدث اختبار»: null للنجاح، أو مفتاح سبب يترجمه قاموس اللوحة. */
export async function sendTestFromAdmin(
  context: StaffContext,
  rawProvider: string,
): Promise<string | null> {
  if (!isTrackingProvider(rawProvider) || !isServerProvider(rawProvider)) {
    return "staff.invalid_request";
  }
  if (!allowTrackingTest(context.staff.id)) {
    return "tracking.too_many_tests";
  }
  const result = await sendTestEvent(
    {
      db: getDb(),
      transport: trackingTransport(),
      adminKey: adminSecretKey(),
      siteUrl: getEnv().SITE_URL,
      clock: () => new Date(),
    },
    context.staff.clubId,
    rawProvider,
  );
  if (result.kind === "sent") {
    return null;
  }
  if (result.kind === "not_sent") {
    return NOT_SENT_REASONS.has(result.reason) ? `tracking.${result.reason}` : "fallback";
  }
  return "tracking.test_failed";
}
