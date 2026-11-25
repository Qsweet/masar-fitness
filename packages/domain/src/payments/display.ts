/**
 * حالة قسم الدفع في صفحة الطلب، فوق `effectiveOrderStatus` (عقد المرحلة 3 لا يُعدَّل): الطلب
 * المعلّق الفائتة مهلته وله محاولة حيّة يُعرض «نتحقق من دفعتك»، لا «انتهت المهلة».
 */
import type { OrderStatus } from "../commerce/lifecycle/order-state";
import type { AttemptStatus } from "./attempt-state";

export type PaymentDisplayState =
  /** يمكن بدء محاولة دفع جديدة. */
  | "pay"
  /** محاولة حيّة قبل موعدها: يكمل العميل الدفع في الجلسة نفسها أو يحدّث الحالة. */
  | "resume"
  /** محاولة حيّة لا يمكن إكمالها من عندنا: ننتظر الحالة النهائية من المزوّد. */
  | "verifying"
  /** حادثة مفتوحة على الطلب: الإدارة تراجع، ولا زر دفع. */
  | "review"
  | "paid"
  | "expired"
  | "closed"
  /** الطلب معلّق لكن الدفع الإلكتروني لا يمكن بدؤه الآن (غير مضبوط، أو لم يبقَ وقت كافٍ). */
  | "unavailable";

export interface PaymentDisplayInput {
  /** الحالة المكتوبة في القاعدة، لا المشتقة. */
  readonly orderStatus: OrderStatus;
  readonly orderExpiresAt: Date;
  readonly now: Date;
  /** المحاولة الحيّة للطلب إن وُجدت. */
  readonly liveAttempt: { readonly status: AttemptStatus; readonly deadlineAt: Date } | null;
  readonly hasOpenIncident: boolean;
  /** مزوّد مضبوط والشراء مفتوح ويبقى وقت يكفي لبدء محاولة. */
  readonly canStart: boolean;
}

const PAID_STATUSES: readonly OrderStatus[] = ["paid", "fulfilled"];

function pendingState(input: PaymentDisplayInput): PaymentDisplayState {
  const { liveAttempt, now } = input;
  if (input.hasOpenIncident) {
    return "review";
  }
  if (liveAttempt !== null) {
    const resumable =
      liveAttempt.status === "pending" && now.getTime() < liveAttempt.deadlineAt.getTime();
    return resumable ? "resume" : "verifying";
  }
  if (now.getTime() >= input.orderExpiresAt.getTime()) {
    return "expired";
  }
  return input.canStart ? "pay" : "unavailable";
}

export function paymentDisplayState(input: PaymentDisplayInput): PaymentDisplayState {
  if (PAID_STATUSES.includes(input.orderStatus)) {
    return "paid";
  }
  if (input.orderStatus === "pending_payment") {
    return pendingState(input);
  }
  if (input.hasOpenIncident) {
    return "review";
  }
  return input.orderStatus === "expired" ? "expired" : "closed";
}
