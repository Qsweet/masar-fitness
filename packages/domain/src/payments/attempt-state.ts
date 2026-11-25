import type { DomainError } from "../errors";
import type { Result } from "../result";
import { nextState, type Transition } from "../commerce/lifecycle/state-machine";

/** حالات محاولة الدفع بترتيب enum القاعدة `payment_attempt_status`. الحالة تتقدم فقط. */
export const ATTEMPT_STATUSES = [
  "created",
  "pending",
  "authorized",
  "captured",
  "failed",
  "voided",
  "expired",
  "refunded",
] as const;

export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];

export const ATTEMPT_EVENTS = [
  "open_session",
  "authorize",
  "capture",
  "fail",
  "expire",
  "void",
  "refund",
] as const;

export type AttemptEvent = (typeof ATTEMPT_EVENTS)[number];

/** لا خروج منها. المحاولة لا تموت إلا بحالة نهائية يقرؤها خادمنا من المزوّد. */
export const TERMINAL_ATTEMPT_STATUSES: readonly AttemptStatus[] = [
  "failed",
  "voided",
  "expired",
  "refunded",
];

/**
 * جدول «محاولة الدفع» (PHASE4_PAYMENTS_DESIGN §5.2). `captured → voided` عكس من المزوّد بعد
 * التحصيل، و`captured → refunded` محجوب حتى تُحسم أهلية الاسترداد (لا كاتب له في 4أ).
 */
export const ATTEMPT_TRANSITIONS: readonly Transition<AttemptStatus, AttemptEvent>[] = [
  { from: "created", event: "open_session", to: "pending" },
  { from: "created", event: "fail", to: "failed" },
  { from: "pending", event: "authorize", to: "authorized" },
  { from: "pending", event: "capture", to: "captured" },
  { from: "pending", event: "fail", to: "failed" },
  { from: "pending", event: "expire", to: "expired" },
  { from: "authorized", event: "capture", to: "captured" },
  { from: "authorized", event: "void", to: "voided" },
  { from: "captured", event: "void", to: "voided" },
  { from: "captured", event: "refund", to: "refunded", blockedBy: "refund_eligibility" },
];

export function nextAttemptStatus(
  from: AttemptStatus,
  event: AttemptEvent,
): Result<AttemptStatus, DomainError> {
  return nextState("payment_attempt", ATTEMPT_TRANSITIONS, from, event);
}

const UNCAPTURED_LIVE: readonly AttemptStatus[] = ["created", "pending", "authorized"];

/**
 * المحاولة الحيّة تحمي طلبها من الإنهاء: لم تبلغ حالة نهائية بعد، أو حُصّلت ولم تُسجَّل نتيجة
 * تسويتها. أوسع من نص الشرط الصلب 2 عن قصد (الدفعة المحصَّلة غير المسجّلة تحمي طلبها أيضًا).
 * يطابق دالة القاعدة `payment_attempt_is_live`.
 */
export function isLiveAttempt(status: AttemptStatus, settled: boolean): boolean {
  return UNCAPTURED_LIVE.includes(status) || (status === "captured" && !settled);
}
