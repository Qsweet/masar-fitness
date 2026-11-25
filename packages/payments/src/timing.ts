/**
 * ثوابت تقنية لتنسيق الدفع والمطابقة. ليست سياسات عمل ولا حقائق مزوّد: قيم مقترحة يراجعها المعماري
 * (PHASE4_PAYMENTS_DESIGN §9، السؤال 13)، وأقل وقت للدفع ليس هنا لأنه يُقاس في التجربة (WP0).
 */
const SECOND_MS = 1_000;
const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** أقصى انتظار لرد المزوّد على استدعاء واحد. */
const PROVIDER_TIMEOUT_SECONDS = 10;
export const PROVIDER_TIMEOUT_MS = PROVIDER_TIMEOUT_SECONDS * SECOND_MS;

/** عمر مطالبة المزامنة: أطول من قراءة جلسة ودفعاتها في أسوأ حال، فتتحرر إن توقفت العملية. */
export const SYNC_LEASE_MS = 2 * MINUTE_MS;

/** بعد كم من موعد المحاولة تُفتح حادثة `stuck_pending` إن بقيت حيّة. */
export const STUCK_ALERT_AFTER_MS = HOUR_MS;

/** أقصر فاصل بين فحصين للمحاولة نفسها في المطابقة، ويتضاعف مع كل فحص حتى السقف. */
export const RECONCILE_BASE_INTERVAL_MS = 2 * MINUTE_MS;
const RECONCILE_MAX_INTERVAL_MINUTES = 30;
export const RECONCILE_MAX_INTERVAL_MS = RECONCILE_MAX_INTERVAL_MINUTES * MINUTE_MS;

/** محاولة بقيت `created` أطول من هذا توقفت عمليتها قبل كتابة نتيجة المزوّد. */
const STALE_CREATED_AFTER_MINUTES = 5;
export const STALE_CREATED_AFTER_MS = STALE_CREATED_AFTER_MINUTES * MINUTE_MS;

/** يُبحث عن جلسة يتيمة لمحاولة فشل بدؤها خلال هذه المدة (بعدها تكون الجلسة قد انتهت بموعدها). */
export const ORPHAN_LOOKBACK_MS = HOUR_MS;

/** المحاولات المسوّاة يُعاد فحصها مرة يوميًا لأسبوع، فيُكشف العكس اللاحق من المزوّد. */
const SETTLED_RECHECK_DAYS = 7;
export const SETTLED_RECHECK_WINDOW_MS = SETTLED_RECHECK_DAYS * DAY_MS;
export const SETTLED_RECHECK_INTERVAL_MS = DAY_MS;

/** حد كل خطوة في دورة المطابقة الواحدة. */
export const RECONCILE_BATCH_SIZE = 50;

/** سقف دورة المطابقة كلها: بعده يتحرر قفلها لدورة تالية. */
const RECONCILE_MAX_DURATION_MINUTES = 5;
export const RECONCILE_MAX_DURATION_MS = RECONCILE_MAX_DURATION_MINUTES * MINUTE_MS;

/** فاصل الفحص بعد `checkCount` فحصًا: تراجع أسّي من الأساس حتى السقف. */
export function reconcileIntervalMs(checkCount: number): number {
  const doublings = Math.max(0, checkCount - 1);
  const interval = RECONCILE_BASE_INTERVAL_MS * 2 ** doublings;
  return Math.min(interval, RECONCILE_MAX_INTERVAL_MS);
}

/** هل حان فحص المحاولة في المطابقة؟ */
export function isSyncDue(lastCheckedAt: Date | null, checkCount: number, now: Date): boolean {
  if (lastCheckedAt === null) {
    return true;
  }
  return now.getTime() - lastCheckedAt.getTime() >= reconcileIntervalMs(checkCount);
}
