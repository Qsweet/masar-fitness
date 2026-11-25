import type { DomainError } from "../../errors";
import type { Result } from "../../result";
import { initialState, nextState, type InitialTransition, type Transition } from "./state-machine";

/** حالات الاسترداد بترتيب enum القاعدة `refund_status`. نموذج فقط: لا دالة تكتب استردادًا. */
export const REFUND_STATUSES = [
  "requested",
  "approved",
  "rejected",
  "processing",
  "completed",
  "failed",
] as const;

export type RefundStatus = (typeof REFUND_STATUSES)[number];

export const REFUND_EVENTS = ["request", "approve", "reject", "start", "complete", "fail"] as const;

export type RefundEvent = (typeof REFUND_EVENTS)[number];

export const TERMINAL_REFUND_STATUSES: readonly RefundStatus[] = [
  "rejected",
  "completed",
  "failed",
];

/** صف «— ⇐ request ⇐ requested»: محجوب حتى تُحسم أهلية الاسترداد. */
export const REFUND_REQUEST: InitialTransition<RefundStatus, RefundEvent> = {
  event: "request",
  to: "requested",
  blockedBy: "refund_eligibility",
};

export const REFUND_TRANSITIONS: readonly Transition<RefundStatus, RefundEvent>[] = [
  { from: "requested", event: "approve", to: "approved", blockedBy: "refund_eligibility" },
  { from: "requested", event: "reject", to: "rejected" },
  { from: "approved", event: "start", to: "processing" },
  { from: "processing", event: "complete", to: "completed" },
  { from: "processing", event: "fail", to: "failed" },
];

/** حالة الاسترداد عند طلبه. اليوم ترجع دائمًا `policy.undecided.refund_eligibility`. */
export function requestedRefundStatus(): Result<RefundStatus, DomainError> {
  return initialState(REFUND_REQUEST);
}

export function nextRefundStatus(
  from: RefundStatus,
  event: RefundEvent,
): Result<RefundStatus, DomainError> {
  return nextState("refund", REFUND_TRANSITIONS, from, event);
}
