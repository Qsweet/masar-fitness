import "server-only";
import { cancelPendingOrder, staffActor, type CancelledOrder } from "@masar/db";
import { DomainError, err, isOrderCancelReason, type Result } from "@masar/domain";
import { getDb } from "../../db";
import type { StaffContext } from "../session";

/** إلغاء طلب معلّق باسم الموظف. السبب رمز من القائمة المغلقة؛ غيره يُرفض قبل أي قراءة. */
export async function cancelOrder(
  context: StaffContext,
  orderId: string,
  reason: string,
  now: Date,
): Promise<Result<CancelledOrder, DomainError>> {
  if (!isOrderCancelReason(reason)) {
    return err(new DomainError("validation", "order.cancel_reason_invalid", { field: "reason" }));
  }
  return cancelPendingOrder(getDb(), {
    orderId,
    clubId: context.staff.clubId,
    reasonCode: reason,
    actor: staffActor(context.staff.id),
    now,
  });
}
