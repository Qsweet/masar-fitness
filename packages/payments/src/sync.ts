/**
 * `syncAttempt`: الطريق الوحيد من حدث خارجي (إشعار، عودة العميل، مطابقة دورية) إلى حالة المحاولة.
 * يقرأ الجلسة من المزوّد بالمفتاح السري، ثم يسلّم اللقطة إلى `applyProviderSnapshot` (المستدعي
 * الوحيد لـ`markOrderPaid`). لا يأخذ من الإشعار ولا من رابط العودة شيئًا: المحرّض اسم للسجل فقط.
 */
import {
  applyProviderSnapshot,
  claimAttemptSync,
  recordSyncFailure,
  releaseAttemptSync,
  type SyncOutcome,
} from "@masar/db";
import type { PaymentDeps } from "./deps";
import type { ProviderError } from "./port";
import { STUCK_ALERT_AFTER_MS, SYNC_LEASE_MS } from "./timing";

export type SyncTrigger = "webhook" | "return" | "reconcile";

export type SyncResult =
  | { readonly kind: "synced"; readonly outcome: SyncOutcome }
  /** مزامنة أخرى للمحاولة جارية الآن (أو لا محاولة بهذا المعرّف): يُكتفى بها. */
  | { readonly kind: "busy" }
  | { readonly kind: "skipped"; readonly reason: "no_session" | "other_provider" | "not_found" }
  /** تعذّرت قراءة المزوّد: الحالة لم تتغير، والمطابقة تعيد لاحقًا. */
  | { readonly kind: "provider_error"; readonly error: ProviderError };

function logOutcome(deps: PaymentDeps, outcome: SyncOutcome, trigger: SyncTrigger): void {
  const base = {
    attemptId: outcome.attemptId,
    orderId: outcome.orderId,
    provider: deps.provider.id,
  };
  deps.logger.info("payment.sync", {
    ...base,
    trigger,
    statusBefore: outcome.previousStatus,
    statusAfter: outcome.status,
    settlement: outcome.settlement,
  });
  if (outcome.settlement === "paid") {
    deps.logger.info("payment.settled", base);
  }
  // سطر خطأ ثابت الاسم لكل حادثة جديدة: هو تنبيه الإدارة حتى تُبنى لوحة الحوادث (المرحلة 5)
  for (const incident of outcome.openedIncidents) {
    deps.logger.error("payment.incident_open", { ...base, incident });
  }
}

export async function syncAttempt(
  deps: PaymentDeps,
  attemptId: string,
  trigger: SyncTrigger,
): Promise<SyncResult> {
  const { db, provider } = deps;
  const attempt = await claimAttemptSync(db, {
    attemptId,
    now: deps.clock(),
    leaseMs: SYNC_LEASE_MS,
  });
  if (attempt === undefined) {
    return { kind: "busy" };
  }
  if (attempt.provider !== provider.id || attempt.providerMode !== provider.mode) {
    await releaseAttemptSync(db, attemptId);
    return { kind: "skipped", reason: "other_provider" };
  }
  if (attempt.providerSessionId === null) {
    await releaseAttemptSync(db, attemptId);
    return { kind: "skipped", reason: "no_session" };
  }
  const view = await provider.fetchSession(attempt.providerSessionId);
  if (!view.ok) {
    await recordSyncFailure(db, attemptId, deps.clock());
    deps.logger.warn("payment.provider_error", {
      attemptId,
      provider: provider.id,
      trigger,
      errorKind: view.error.kind,
      errorCode: view.error.code,
      httpStatus: view.error.httpStatus,
    });
    return { kind: "provider_error", error: view.error };
  }
  const applied = await applyProviderSnapshot(db, {
    attemptId,
    snapshot: view.value.snapshot,
    now: deps.clock(),
    stuckAlertAfterMs: STUCK_ALERT_AFTER_MS,
  });
  if (!applied.ok) {
    return { kind: "skipped", reason: "not_found" };
  }
  logOutcome(deps, applied.value, trigger);
  return { kind: "synced", outcome: applied.value };
}
