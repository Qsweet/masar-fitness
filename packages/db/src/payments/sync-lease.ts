/** مطالبة المزامنة: مزامنة واحدة لكل محاولة في كل لحظة، فلا يتكرر استدعاء المزوّد بلا حاجة. */
import type { Db } from "../client";
import type { PaymentAttempt } from "../generated/prisma/client";
import { toAttemptRecord, type PaymentAttemptRecord } from "./records";

export interface ClaimSyncInput {
  readonly attemptId: string;
  readonly now: Date;
  /** عمر المطالبة: أطول من أسوأ زمن لقراءة المزوّد، فإن توقفت العملية تحررت المحاولة بعده. */
  readonly leaseMs: number;
}

/**
 * يطالب بمزامنة المحاولة. يرجع صفها إن نال المطالبة، أو undefined إن كانت مزامنة أخرى جارية
 * (أو لا محاولة بهذا المعرّف)، فيُكتفى بها. `applyProviderSnapshot` تحرر المطالبة عند الكتابة.
 */
export async function claimAttemptSync(
  db: Db,
  input: ClaimSyncInput,
): Promise<PaymentAttemptRecord | undefined> {
  const leaseUntil = new Date(input.now.getTime() + input.leaseMs);
  const claimed = await db.$queryRaw<{ id: string }[]>`
    UPDATE payment_attempts SET sync_lease_until = ${leaseUntil}
    WHERE id = ${input.attemptId}::uuid
      AND (sync_lease_until IS NULL OR sync_lease_until < ${input.now})
    RETURNING id::text AS id`;
  if (claimed.length === 0) {
    return undefined;
  }
  const row: PaymentAttempt = await db.paymentAttempt.findUniqueOrThrow({
    where: { id: input.attemptId },
  });
  return toAttemptRecord(row);
}

/** تعذّرت قراءة المزوّد: تُحرَّر المطالبة ويُعدّ الفحص، فيتراجع تكرار المطابقة ولا تتغير الحالة. */
export async function recordSyncFailure(db: Db, attemptId: string, now: Date): Promise<void> {
  await db.$executeRaw`
    UPDATE payment_attempts
    SET sync_lease_until = NULL, last_checked_at = ${now}, check_count = check_count + 1,
      updated_at = ${now}
    WHERE id = ${attemptId}::uuid`;
}

/** تُحرَّر المطالبة بلا فحص (محاولة لا جلسة لها أو ليست لهذا المزوّد). */
export async function releaseAttemptSync(db: Db, attemptId: string): Promise<void> {
  await db.$executeRaw`
    UPDATE payment_attempts SET sync_lease_until = NULL WHERE id = ${attemptId}::uuid`;
}
