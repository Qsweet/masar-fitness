/** قفل الطلب وقراءة محاولته الحيّة لإجراءات اللوحة. القفل نفسه الذي يأخذه T8 و`markOrderPaid`. */
import type { OrderStatus } from "../generated/prisma/client";
import type { Tx } from "../commerce/transaction";

export interface LockedAdminOrder {
  readonly id: string;
  readonly club_id: string;
  readonly reference: string;
  readonly status: OrderStatus;
  readonly expires_at: Date;
  readonly created_at: Date;
  readonly total_minor: number;
  readonly currency: string;
  readonly paid_provider: string | null;
  readonly paid_provider_payment_id: string | null;
}

/** يقفل الطلب داخل نادي الموظف؛ معرّف من نادٍ آخر لا يُقفل ولا يُرى. */
export async function lockOrderInClub(
  tx: Tx,
  orderId: string,
  clubId: string,
): Promise<LockedAdminOrder | undefined> {
  const rows = await tx.$queryRaw<LockedAdminOrder[]>`
    SELECT id::text AS id, club_id::text AS club_id, reference, status, expires_at, created_at,
      total_minor, currency, paid_provider, paid_provider_payment_id
    FROM orders WHERE id = ${orderId}::uuid AND club_id = ${clubId}::uuid FOR UPDATE`;
  return rows[0];
}

/**
 * هل للطلب محاولة دفع حيّة؟ تُقرأ **بعد** قفل الطلب: بدء محاولة جديدة يأخذ القفل نفسه (T8)، فما يُقرأ
 * هنا لا يتغير حتى نهاية المعاملة. التعريف نفسه `payment_attempt_is_live`.
 */
export async function hasLiveAttempt(tx: Tx, orderId: string): Promise<boolean> {
  const rows = await tx.$queryRaw<{ live: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM payment_attempts a
      WHERE a.order_id = ${orderId}::uuid AND payment_attempt_is_live(a.status, a.settled_at)
    ) AS live`;
  return rows[0]?.live === true;
}
