import { DomainError } from "../../errors";
import { err, ok, type Result } from "../../result";
import { nextOrderStatus, type OrderStatus } from "./order-state";

/**
 * أسباب إلغاء الطلب من اللوحة: قائمة مغلقة تُكتب رمزًا في التدقيق. بلا نص حر: لا يُضمن خلوّه من اسم
 * أو جوال (ADMIN_A2_SALES §6.4).
 */
export const ORDER_CANCEL_REASONS = [
  "customer_request",
  "duplicate_order",
  "created_by_mistake",
  "other",
] as const;
export type OrderCancelReason = (typeof ORDER_CANCEL_REASONS)[number];

export function isOrderCancelReason(value: unknown): value is OrderCancelReason {
  return ORDER_CANCEL_REASONS.some((reason) => reason === value);
}

export interface CancellableOrder {
  readonly status: OrderStatus;
  readonly expiresAt: Date;
  /** محاولة دفع حيّة (تعريف `isLiveAttempt`): العميل في صفحة المزوّد الآن. */
  readonly hasLiveAttempt: boolean;
}

/** `apply`: ألغِ الآن. `replay`: ملغى من قبل، فلا كتابة. */
export type CancellationDecision = "apply" | "replay";

/**
 * يقرر إلغاء طلب من اللوحة. يُلغى المعلّق الذي لم يبلغ مهلته وبلا محاولة حيّة فقط: إلغاء طلب تحت
 * عميل يدفع يحوّل دفعته إلى مال بلا اشتراك، والطلب الذي بلغ مهلته منتهٍ فعلًا وإن لم يُكتب.
 */
export function decideOrderCancellation(
  order: CancellableOrder,
  now: Date,
): Result<CancellationDecision, DomainError> {
  if (order.status === "cancelled") {
    return ok("replay");
  }
  const next = nextOrderStatus(order.status, "cancel");
  if (!next.ok || now.getTime() >= order.expiresAt.getTime()) {
    return err(new DomainError("conflict", "order.not_cancellable"));
  }
  if (order.hasLiveAttempt) {
    return err(new DomainError("conflict", "order.cancel_blocked_by_live_attempt"));
  }
  return ok("apply");
}
