/**
 * المرسِل (ADMIN_A5_TRACKING §4.1–4.2): يحجز دفعة من الطابور، ويبني كل حمولة من الطلب لحظة الإرسال،
 * ويفك المفتاح عندها فقط، ويسجّل النتيجة. لا يرمي لحدث واحد فاسد: يسجّله ويكمل.
 */
import {
  claimDueEvents,
  loadPurchaseContext,
  loadSendableIntegration,
  recordAttempt,
  type ClaimedEvent,
  type Db,
} from "@masar/db";
import { decideDelivery, isTooOld, providerCategories, type DeliveryDecision } from "@masar/domain";
import { buildPurchase, interpret, type Built } from "./payloads";
import { openTrackingSecret } from "./secret";
import type { TrackingTransport } from "./transport";

export interface DispatchDeps {
  readonly db: Db;
  readonly transport: TrackingTransport;
  readonly adminKey: Uint8Array;
  readonly siteUrl: string;
  readonly clock: () => Date;
  readonly batchSize?: number;
}

export interface DispatchSummary {
  readonly claimed: number;
  readonly sent: number;
  readonly retried: number;
  readonly dead: number;
  readonly skipped: number;
}

const DEFAULT_BATCH = 50;

type Prepared =
  | { readonly kind: "built"; readonly built: Built }
  | { readonly kind: "final"; readonly outcome: "skipped" | "dead"; readonly reason: string };

function final(outcome: "skipped" | "dead", reason: string): Prepared {
  return { kind: "final", outcome, reason };
}

/** كل ما يمنع الإرسال قبل الشبكة: المنصة، المفتاح، الطلب، العمر، الموافقة. */
async function prepare(deps: DispatchDeps, event: ClaimedEvent, now: Date): Promise<Prepared> {
  const integration = await loadSendableIntegration(deps.db, event.clubId, event.provider);
  if (integration?.enabled !== true) {
    return final("skipped", "disabled");
  }
  if (integration.secretEnc === null) {
    return final("skipped", "no_secret");
  }
  const secret = openTrackingSecret(
    deps.adminKey,
    event.clubId,
    event.provider,
    integration.secretEnc,
  );
  if (secret === null) {
    return final("skipped", "secret_unreadable");
  }
  const purchase = await loadPurchaseContext(deps.db, event.orderId);
  if (purchase === null) {
    return final("skipped", "no_order_context");
  }
  if (isTooOld(event.provider, event.eventTime, now)) {
    return final("dead", "too_old");
  }
  const analytics = providerCategories(event.provider).includes("analytics");
  if (!(analytics ? purchase.consentAnalytics : purchase.consentAds)) {
    return final("skipped", "no_consent");
  }
  const input = {
    purchase,
    eventId: event.eventId,
    config: integration.config,
    secret,
    siteUrl: deps.siteUrl,
  };
  return { kind: "built", built: buildPurchase(event.provider, input) };
}

async function deliver(
  deps: DispatchDeps,
  event: ClaimedEvent,
  now: Date,
): Promise<DeliveryDecision["kind"] | "skipped"> {
  const prepared = await prepare(deps, event, now);
  if (prepared.kind === "final") {
    const result =
      prepared.outcome === "dead"
        ? ({ kind: "dead", status: null, reason: prepared.reason } as const)
        : ({ kind: "skipped", reason: prepared.reason } as const);
    await recordAttempt(deps.db, event.id, result, now);
    return prepared.outcome;
  }
  if (prepared.built.kind === "skip") {
    await recordAttempt(deps.db, event.id, { kind: "skipped", reason: prepared.built.reason }, now);
    return "skipped";
  }
  const response = await deps.transport(prepared.built.request);
  const status = response.kind === "response" ? response.status : null;
  const decision = decideDelivery(
    interpret(event.provider, response),
    event.attempts + 1,
    deps.clock(),
  );
  await recordAttempt(
    deps.db,
    event.id,
    decision.kind === "sent" ? { kind: "sent", status } : { ...decision, status },
    deps.clock(),
  );
  return decision.kind;
}

/** دورة واحدة: يرجع عدد كل نتيجة. يُشغَّل بمؤقت كل دقيقة، ومرسِلان معًا لا يأخذان السطر نفسه. */
export async function runDispatch(deps: DispatchDeps): Promise<DispatchSummary> {
  const now = deps.clock();
  const events = await claimDueEvents(deps.db, now, deps.batchSize ?? DEFAULT_BATCH);
  const counts = { sent: 0, retry: 0, dead: 0, skipped: 0 };
  for (const event of events) {
    counts[await deliver(deps, event, now)] += 1;
  }
  return {
    claimed: events.length,
    sent: counts.sent,
    retried: counts.retry,
    dead: counts.dead,
    skipped: counts.skipped,
  };
}
