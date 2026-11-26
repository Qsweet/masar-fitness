/**
 * أسماء المحفّزات والقيود التي هي سدود أخيرة لسباقات إدارة الطلبات ⇒ سبب خطأ العمل المقابل، فلا يصل
 * نص SQL إلى الواجهة. ما عداها يبقى عطلًا: القيد الذي يرفض كتابة الكود نفسه خلل يجب أن يظهر.
 */
import { DomainError } from "@masar/domain";
import { constraintName } from "../commerce/sql-errors";

export const ORDERS_ADMIN_CONSTRAINTS = {
  cancelLiveAttempt: "order_cancel_blocked_by_live_attempt",
  manualOrderNotPending: "manual_payment_order_not_pending",
  manualLiveAttempt: "manual_payment_blocked_by_live_attempt",
  manualSnapshotMismatch: "manual_payment_snapshot_mismatch",
  manualOrderUnique: "manual_payments_order_id_key",
  manualReferenceUnique: "manual_payments_club_id_method_external_reference_key",
  manualPrimaryKey: "manual_payments_pkey",
} as const;

const REASONS: ReadonlyMap<string, string> = new Map([
  [ORDERS_ADMIN_CONSTRAINTS.cancelLiveAttempt, "order.cancel_blocked_by_live_attempt"],
  [ORDERS_ADMIN_CONSTRAINTS.manualOrderNotPending, "order.not_payable"],
  [ORDERS_ADMIN_CONSTRAINTS.manualLiveAttempt, "order.settle_blocked_by_live_attempt"],
  [ORDERS_ADMIN_CONSTRAINTS.manualSnapshotMismatch, "payment.amount_mismatch"],
  [ORDERS_ADMIN_CONSTRAINTS.manualOrderUnique, "order.already_paid"],
  [ORDERS_ADMIN_CONSTRAINTS.manualReferenceUnique, "manual_payment.reference_used"],
  // المعرّف نفسه لطلب آخر: نموذج تأكيد أُعيد استعماله على غير طلبه
  [ORDERS_ADMIN_CONSTRAINTS.manualPrimaryKey, "manual_payment.reference_used"],
]);

export function mapOrdersAdminDbError(error: unknown): DomainError | undefined {
  const name = constraintName(error);
  const reason = name === undefined ? undefined : REASONS.get(name);
  return reason === undefined ? undefined : new DomainError("conflict", reason, { cause: error });
}
