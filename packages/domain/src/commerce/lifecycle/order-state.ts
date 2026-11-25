import { DomainError } from "../../errors";
import type { Result } from "../../result";
import { nextState, type Transition } from "./state-machine";

/** حالات الطلب بترتيب enum القاعدة `order_status`. لا حالة draft: الطلب يُنشأ معلّقًا مباشرة. */
export const ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "fulfilled",
  "expired",
  "cancelled",
  "partially_refunded",
  "refunded",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_EVENTS = [
  "payment_verified",
  "expire",
  "cancel",
  "fulfil",
  "refund_partial",
  "refund_full",
] as const;

export type OrderEvent = (typeof ORDER_EVENTS)[number];

/** لا خروج منها. الدفعة على طلب منتهٍ ترجع `order.not_payable` ولا تُحييه. */
export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = ["expired", "cancelled", "refunded"];

const REFUNDABLE: readonly OrderStatus[] = ["paid", "fulfilled", "partially_refunded"];

function refundRows(event: OrderEvent, to: OrderStatus): Transition<OrderStatus, OrderEvent>[] {
  return REFUNDABLE.map((from) => ({ from, event, to, blockedBy: "refund_eligibility" }));
}

/** جدول «آلات الحالة ← الطلب». الاسترداد محجوب حتى تُحسم أهليته. */
export const ORDER_TRANSITIONS: readonly Transition<OrderStatus, OrderEvent>[] = [
  { from: "pending_payment", event: "payment_verified", to: "paid" },
  { from: "pending_payment", event: "expire", to: "expired" },
  { from: "pending_payment", event: "cancel", to: "cancelled" },
  { from: "paid", event: "fulfil", to: "fulfilled" },
  ...refundRows("refund_partial", "partially_refunded"),
  ...refundRows("refund_full", "refunded"),
];

export function nextOrderStatus(
  from: OrderStatus,
  event: OrderEvent,
): Result<OrderStatus, DomainError> {
  return nextState("order", ORDER_TRANSITIONS, from, event);
}

/**
 * الحالة كما يجب أن تُعرض: الطلب المعلّق الذي بلغ مهلته منتهٍ وإن لم يُكتب ذلك بعد.
 * الصحة لا تعتمد على جدولة الإنهاء.
 */
export function effectiveOrderStatus(status: OrderStatus, expiresAt: Date, now: Date): OrderStatus {
  if (status === "pending_payment" && now.getTime() >= expiresAt.getTime()) {
    return "expired";
  }
  return status;
}

const MS_PER_MINUTE = 60_000;

/** موعد انتهاء مهلة الدفع. المهلة من `clubs.order_payment_window_minutes` ولا قيمة لها في الكود. */
export function orderExpiry(createdAt: Date, windowMinutes: number): Date {
  if (!Number.isSafeInteger(windowMinutes) || windowMinutes <= 0) {
    throw new DomainError("invariant", "order.invalid_payment_window");
  }
  if (Number.isNaN(createdAt.getTime())) {
    throw new DomainError("invariant", "order.invalid_created_at");
  }
  return new Date(createdAt.getTime() + windowMinutes * MS_PER_MINUTE);
}
