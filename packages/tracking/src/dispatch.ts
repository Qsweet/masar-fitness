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
import { TRANSPORT_TIMEOUT_MS, type TrackingTransport } from "./transport";

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
const LEASE_MARGIN_MS = 60_000;

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
    await recordAttempt(deps.db, event, result, now);
    return prepared.outcome;
  }
  if (prepared.built.kind === "skip") {
    await recordAttempt(deps.db, event, { kind: "skipped", reason: prepared.built.reason }, now);
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
    event,
    decision.kind === "sent" ? { kind: "sent", status } : { ...decision, status },
    deps.clock(),
  );
  return decision.kind;
}

/** سبب ثابت لاستثناء غير متوقع في حدث واحد (حمولة، قاعدة، ناقل). */
export const INTERNAL_ERROR = "internal_error";
const INTERNAL_OUTCOME = {
  kind: "response",
  status: 0,
  apiError: INTERNAL_ERROR,
  apiRetryable: true,
} as const;

/**
 * حدث يرمي لا يوقف الدفعة (القرار 89-3): يُسجَّل `internal_error` محاولةً تُعاد، فالرمي الثابت يموت
 * بعد أقصى المحاولات. إن فشل التسجيل نفسه (القاعدة) يبقى الحجز وينقضي فيعود السطر.
 */
async function deliverSafely(
  deps: DispatchDeps,
  event: ClaimedEvent,
  now: Date,
): Promise<DeliveryDecision["kind"] | "skipped"> {
  try {
    return await deliver(deps, event, now);
  } catch {
    const decision = decideDelivery(INTERNAL_OUTCOME, event.attempts + 1, deps.clock());
    const result =
      decision.kind === "sent"
        ? { kind: "sent" as const, status: null }
        : { ...decision, status: null };
    await recordAttempt(deps.db, event, result, deps.clock()).catch(() => false);
    return decision.kind;
  }
}

/**
 * مهلة الحجز أطول من أسوأ زمن للدفعة (كل حدث بمهلة الناقل كاملة) بضعفين ودقيقة (القرار 89-2)، فلا
 * يعود سطر إلى الطابور ومرسِله ما زال يعمل عليه؛ والرمز يمنع الكتابة المزدوجة إن حدث.
 */
export function leaseFor(batchSize: number): number {
  return batchSize * TRANSPORT_TIMEOUT_MS * 2 + LEASE_MARGIN_MS;
}

/** دورة واحدة: يرجع عدد كل نتيجة. يُشغَّل بمؤقت كل دقيقة، ومرسِلان معًا لا يأخذان السطر نفسه. */
export async function runDispatch(deps: DispatchDeps): Promise<DispatchSummary> {
  const now = deps.clock();
  const batch = deps.batchSize ?? DEFAULT_BATCH;
  const events = await claimDueEvents(deps.db, now, batch, leaseFor(batch));
  const counts = { sent: 0, retry: 0, dead: 0, skipped: 0 };
  for (const event of events) {
    counts[await deliverSafely(deps, event, now)] += 1;
  }
  return {
    claimed: events.length,
    sent: counts.sent,
    retried: counts.retry,
    dead: counts.dead,
    skipped: counts.skipped,
  };
}
