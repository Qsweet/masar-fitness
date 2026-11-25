/**
 * مهمة المطابقة الدورية (PHASE4_PAYMENTS_DESIGN §5.7): الإشعار قد لا يصل، والعميل قد لا يعود.
 * كل خطوة بحدّ دفعة، وكل تغيير حالة يمر من `syncAttempt`. لا تُنهى محاولة عند موعدها دون سؤال
 * المزوّد: يُلغى ما يمكن إلغاؤه من جلستها ثم تُقرأ حالتها، فلا يُحرَّر طلب ودفعته في الطريق.
 */
import {
  listFailedStarts,
  listLiveAttemptsForSync,
  listSettledForRecheck,
  listStaleCreatedAttempts,
  markAttemptStartFailed,
  withReconcileLock,
  type PaymentAttemptRecord,
  type ReconcileRun,
} from "@masar/db";
import type { PaymentDeps } from "./deps";
import { syncAttempt } from "./sync";
import {
  ORPHAN_LOOKBACK_MS,
  RECONCILE_BASE_INTERVAL_MS,
  RECONCILE_BATCH_SIZE,
  RECONCILE_MAX_DURATION_MS,
  SETTLED_RECHECK_INTERVAL_MS,
  SETTLED_RECHECK_WINDOW_MS,
  STALE_CREATED_AFTER_MS,
  isSyncDue,
} from "./timing";

export interface ReconcileSummary {
  /** محاولات بقيت created فكُتبت failed (توقفت عمليتها). */
  readonly interrupted: number;
  /** محاولات حيّة قُرئت من المزوّد. */
  readonly synced: number;
  /** جلسات بلغت موعدها فأُلغيت عند المزوّد قبل قراءتها. */
  readonly cancelled: number;
  /** جلسات يتيمة أُلغيت. */
  readonly orphans: number;
  /** محاولات مسوّاة أُعيد فحصها لكشف العكس اللاحق. */
  readonly rechecked: number;
}

function ago(now: Date, ms: number): Date {
  return new Date(now.getTime() - ms);
}

async function failInterruptedStarts(deps: PaymentDeps, now: Date): Promise<number> {
  const stale = await listStaleCreatedAttempts(deps.db, {
    provider: deps.provider.id,
    createdBefore: ago(now, STALE_CREATED_AFTER_MS),
    limit: RECONCILE_BATCH_SIZE,
  });
  let failed = 0;
  for (const attempt of stale) {
    const reason = "start_interrupted";
    const result = await markAttemptStartFailed(deps.db, { attemptId: attempt.id, reason, now });
    failed += result.ok ? 1 : 0;
  }
  return failed;
}

/** جلسة بلغت موعدها تُلغى عند المزوّد أولًا (أفضل جهد)، ثم تُقرأ حالتها النهائية. */
async function cancelIfPastDeadline(
  deps: PaymentDeps,
  attempt: PaymentAttemptRecord,
  now: Date,
): Promise<boolean> {
  const due = attempt.status === "pending" && now.getTime() >= attempt.deadlineAt.getTime();
  if (!due || attempt.providerSessionId === null) {
    return false;
  }
  const cancelled = await deps.provider.cancelSession(attempt.providerSessionId);
  return cancelled.ok;
}

async function syncLiveAttempts(deps: PaymentDeps, now: Date) {
  const candidates = await listLiveAttemptsForSync(deps.db, {
    provider: deps.provider.id,
    checkedBefore: ago(now, RECONCILE_BASE_INTERVAL_MS),
    limit: RECONCILE_BATCH_SIZE,
  });
  let synced = 0;
  let cancelled = 0;
  for (const attempt of candidates) {
    if (!isSyncDue(attempt.lastCheckedAt, attempt.checkCount, now)) {
      continue;
    }
    cancelled += (await cancelIfPastDeadline(deps, attempt, now)) ? 1 : 0;
    await syncAttempt(deps, attempt.id, "reconcile");
    synced += 1;
  }
  return { synced, cancelled };
}

/**
 * محاولة فشل بدؤها قد تكون تركت جلسة عند المزوّد (انقطاع بعد الإنشاء): تُبحث وتُلغى. المزوّد الذي
 * لا يُعرف بحثه بعد (`needs_sandbox_verification`) تُتخطى خطوته بتحذير واحد: الجلسة تنتهي بموعدها.
 */
async function cancelOrphanSessions(deps: PaymentDeps, now: Date): Promise<number> {
  const failed = await listFailedStarts(deps.db, {
    provider: deps.provider.id,
    endedAfter: ago(now, ORPHAN_LOOKBACK_MS),
    limit: RECONCILE_BATCH_SIZE,
  });
  let cancelled = 0;
  for (const attempt of failed) {
    const sessions = await deps.provider.findSessionsForAttempt(attempt.id);
    if (!sessions.ok) {
      const unverified = sessions.error.kind === "needs_sandbox_verification";
      deps.logger.warn(
        unverified ? "payment.needs_sandbox_verification" : "payment.provider_error",
        {
          provider: deps.provider.id,
          errorKind: sessions.error.kind,
          errorCode: sessions.error.code,
        },
      );
      return cancelled;
    }
    for (const sessionId of sessions.value) {
      cancelled += (await deps.provider.cancelSession(sessionId)).ok ? 1 : 0;
    }
  }
  return cancelled;
}

async function recheckSettled(deps: PaymentDeps, now: Date): Promise<number> {
  const settled = await listSettledForRecheck(deps.db, {
    provider: deps.provider.id,
    settledAfter: ago(now, SETTLED_RECHECK_WINDOW_MS),
    checkedBefore: ago(now, SETTLED_RECHECK_INTERVAL_MS),
    limit: RECONCILE_BATCH_SIZE,
  });
  for (const attempt of settled) {
    await syncAttempt(deps, attempt.id, "reconcile");
  }
  return settled.length;
}

/** دورة مطابقة واحدة بلا قفل. المستدعي المجدول يستعمل `runReconcile`. */
export async function reconcileOnce(deps: PaymentDeps): Promise<ReconcileSummary> {
  const now = deps.clock();
  const interrupted = await failInterruptedStarts(deps, now);
  const { synced, cancelled } = await syncLiveAttempts(deps, now);
  const orphans = await cancelOrphanSessions(deps, now);
  const rechecked = await recheckSettled(deps, now);
  const summary = { interrupted, synced, cancelled, orphans, rechecked };
  deps.logger.info("payment.reconcile", { provider: deps.provider.id, count: synced + rechecked });
  return summary;
}

/** دورة مطابقة تحت قفلها: إن كانت دورة أخرى جارية رجعت `ran: false` فورًا. */
export function runReconcile(deps: PaymentDeps): Promise<ReconcileRun<ReconcileSummary>> {
  return withReconcileLock(deps.db, RECONCILE_MAX_DURATION_MS, () => reconcileOnce(deps));
}
