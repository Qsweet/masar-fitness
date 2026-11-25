/**
 * قفل مهمة المطابقة: دورة واحدة في كل لحظة. قفل استشاري على مستوى معاملة لا تمسّ أي صف، تبقى
 * مفتوحة مدة الدورة، والعمل نفسه (ومنه استدعاءات المزوّد) يجري على اتصالات أخرى خارجها، فلا قفل
 * صف يُحمل أثناء استدعاء شبكي.
 */
import type { Db } from "../client";

const RECONCILE_LOCK_NAME = "masar.payments.reconcile";
/** أقصى انتظار لاتصال القفل (مللي ثانية). */
const LOCK_MAX_WAIT_MS = 5_000;

export type ReconcileRun<T> = { readonly ran: true; readonly value: T } | { readonly ran: false };

/**
 * يشغّل `work` إن لم تكن دورة أخرى جارية، وإلا يرجع `ran: false` فورًا بلا انتظار.
 * `maxDurationMs` سقف الدورة: بعده تُلغى معاملة القفل فيتحرر لدورة تالية.
 */
export async function withReconcileLock<T>(
  db: Db,
  maxDurationMs: number,
  work: () => Promise<T>,
): Promise<ReconcileRun<T>> {
  return db.$transaction(
    async (tx): Promise<ReconcileRun<T>> => {
      const rows = await tx.$queryRaw<{ locked: boolean }[]>`
        SELECT pg_try_advisory_xact_lock(hashtextextended(${RECONCILE_LOCK_NAME}, 0)) AS locked`;
      if (rows[0]?.locked !== true) {
        return { ran: false };
      }
      return { ran: true, value: await work() };
    },
    { maxWait: LOCK_MAX_WAIT_MS, timeout: maxDurationMs },
  );
}
