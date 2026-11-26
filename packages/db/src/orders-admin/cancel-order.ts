/**
 * إلغاء طلب معلّق من اللوحة (ADMIN_A2_SALES §6.4). معاملة واحدة: قفل الطلب، ثم قراءة المحاولة الحيّة،
 * ثم القرار في المجال، ثم الانتقال المشروط وسطر تدقيقه. T11 سدّ احتياطي في القاعدة.
 */
import {
  DomainError,
  decideOrderCancellation,
  err,
  ok,
  type OrderCancelReason,
  type Result,
} from "@masar/domain";
import type { Db } from "../client";
import { writeAudit, type StaffAuditActor } from "../commerce/audit";
import { inTransaction, type Tx } from "../commerce/transaction";
import { hasLiveAttempt, lockOrderInClub, type LockedAdminOrder } from "./locks";
import { mapOrdersAdminDbError } from "./sql-errors";

export interface CancelOrderInput {
  readonly orderId: string;
  readonly clubId: string;
  /** رمز من القائمة المغلقة؛ لا نص حر في التدقيق. */
  readonly reasonCode: OrderCancelReason;
  readonly actor: StaffAuditActor;
  readonly now: Date;
}

export interface CancelledOrder {
  readonly orderId: string;
  readonly reference: string;
  /** كان ملغى من قبل: لا كتابة ولا سطر تدقيق ثانٍ. */
  readonly replayed: boolean;
}

async function writeCancellation(tx: Tx, order: LockedAdminOrder, input: CancelOrderInput) {
  const updated = await tx.$executeRaw`
    UPDATE orders SET status = 'cancelled', cancelled_at = ${input.now}
    WHERE id = ${order.id}::uuid AND status = 'pending_payment'`;
  if (updated !== 1) {
    throw new DomainError("invariant", "order.cancel_not_recorded");
  }
  await writeAudit(tx, {
    clubId: order.club_id,
    entityType: "order",
    entityId: order.id,
    action: "order_cancelled",
    fromState: "pending_payment",
    toState: "cancelled",
    actor: input.actor,
    data: { reference: order.reference, reason: input.reasonCode },
    at: input.now,
  });
}

async function cancelInTransaction(
  tx: Tx,
  input: CancelOrderInput,
): Promise<Result<CancelledOrder, DomainError>> {
  const order = await lockOrderInClub(tx, input.orderId, input.clubId);
  if (order === undefined) {
    return err(new DomainError("not_found", "order.not_found"));
  }
  const decision = decideOrderCancellation(
    {
      status: order.status,
      expiresAt: order.expires_at,
      hasLiveAttempt: await hasLiveAttempt(tx, order.id),
    },
    input.now,
  );
  if (!decision.ok) {
    return decision;
  }
  if (decision.value === "apply") {
    await writeCancellation(tx, order, input);
  }
  return ok({
    orderId: order.id,
    reference: order.reference,
    replayed: decision.value === "replay",
  });
}

/** يلغي معلّقًا لم يبلغ مهلته وبلا محاولة حيّة. الإلغاء نهائي (T2)، ويحرر استخدام الكوبون. */
export async function cancelPendingOrder(
  db: Db,
  input: CancelOrderInput,
): Promise<Result<CancelledOrder, DomainError>> {
  try {
    return await inTransaction(db, (tx) => cancelInTransaction(tx, input));
  } catch (error) {
    const mapped = mapOrdersAdminDbError(error);
    if (mapped !== undefined) {
      return err(mapped);
    }
    throw error;
  }
}
