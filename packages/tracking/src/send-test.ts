/**
 * «أرسل حدث اختبار» من اللوحة (ADMIN_A5_TRACKING §8): حدث بلا بيانات عميل، إلى نقطة الاختبار أو برمز
 * الاختبار، بالناقل نفسه، ويُسجَّل بنتيجته. المفتاح يُفك هنا ولا يخرج.
 */
import { loadSendableIntegration, recordTestEvent, type Db } from "@masar/db";
import { decideDelivery, type ServerProvider } from "@masar/domain";
import { randomUUID } from "node:crypto";
import { buildTest, interpret } from "./payloads";
import { openTrackingSecret } from "./secret";
import type { TrackingTransport } from "./transport";

export interface TestDeps {
  readonly db: Db;
  readonly transport: TrackingTransport;
  readonly adminKey: Uint8Array;
  readonly siteUrl: string;
  readonly clock: () => Date;
}

export type TestEventResult =
  | { readonly kind: "sent"; readonly status: number | null }
  | { readonly kind: "failed"; readonly status: number | null; readonly reason: string }
  /** لم يُرسل شيء: إعداد ناقص أو لا مفتاح أو لا رمز اختبار. */
  | { readonly kind: "not_sent"; readonly reason: string };

async function secretOf(deps: TestDeps, clubId: string, provider: ServerProvider) {
  const integration = await loadSendableIntegration(deps.db, clubId, provider);
  if (integration === null) {
    return { integration, secret: null, reason: "not_configured" };
  }
  if (integration.secretEnc === null) {
    return { integration, secret: null, reason: "no_secret" };
  }
  const secret = openTrackingSecret(deps.adminKey, clubId, provider, integration.secretEnc);
  return { integration, secret, reason: secret === null ? "secret_unreadable" : "" };
}

export async function sendTestEvent(
  deps: TestDeps,
  clubId: string,
  provider: ServerProvider,
): Promise<TestEventResult> {
  const { integration, secret, reason } = await secretOf(deps, clubId, provider);
  if (integration === null || secret === null) {
    return { kind: "not_sent", reason };
  }
  const now = deps.clock();
  const eventId = `test.${randomUUID()}`;
  const built = buildTest(provider, {
    config: integration.config,
    secret,
    testEventCode: integration.testEventCode,
    eventId,
    siteUrl: deps.siteUrl,
    now,
  });
  if (built.kind === "skip") {
    return { kind: "not_sent", reason: built.reason };
  }
  const response = await deps.transport(built.request);
  const status = response.kind === "response" ? response.status : null;
  const decision = decideDelivery(interpret(provider, response), 1, deps.clock());
  const delivered = decision.kind === "sent";
  const failure = decision.kind === "sent" ? null : decision.reason;
  await recordTestEvent(deps.db, {
    clubId,
    provider,
    eventName: built.eventName,
    eventId,
    delivered,
    status,
    reason: failure,
    now,
  });
  return failure === null ? { kind: "sent", status } : { kind: "failed", status, reason: failure };
}
