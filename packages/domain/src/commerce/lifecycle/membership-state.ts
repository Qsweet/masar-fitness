import { DomainError } from "../../errors";
import type { Result } from "../../result";
import { comparePlainDates, type PlainDate } from "./plain-date";
import { nextState, type Transition } from "./state-machine";

/** حالات الاشتراك بترتيب enum القاعدة `membership_status`. */
export const MEMBERSHIP_STATUSES = [
  "scheduled",
  "active",
  "frozen",
  "expired",
  "cancelled",
] as const;

export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const MEMBERSHIP_EVENTS = [
  "start_confirmed",
  "freeze",
  "unfreeze",
  "period_ended",
  "cancel",
] as const;

export type MembershipEvent = (typeof MEMBERSHIP_EVENTS)[number];

export const TERMINAL_MEMBERSHIP_STATUSES: readonly MembershipStatus[] = ["expired", "cancelled"];

const CANCELLABLE: readonly MembershipStatus[] = ["scheduled", "active", "frozen"];

/**
 * جدول «آلات الحالة ← الاشتراك». الإنشاء نفسه تقرره `decideMembershipStart`.
 * لا انتقال للترقية، والتجميد والإلغاء وتأكيد البدء محجوبة حتى يحسمها المالك.
 */
export const MEMBERSHIP_TRANSITIONS: readonly Transition<MembershipStatus, MembershipEvent>[] = [
  { from: "scheduled", event: "start_confirmed", to: "active", blockedBy: "renewal_start" },
  { from: "active", event: "freeze", to: "frozen", blockedBy: "freeze_rules" },
  { from: "frozen", event: "unfreeze", to: "active", blockedBy: "freeze_rules" },
  { from: "active", event: "period_ended", to: "expired" },
  ...CANCELLABLE.map((from) => ({
    from,
    event: "cancel" as const,
    to: "cancelled" as const,
    blockedBy: "cancellation_rules" as const,
  })),
];

export function nextMembershipStatus(
  from: MembershipStatus,
  event: MembershipEvent,
): Result<MembershipStatus, DomainError> {
  return nextState("membership", MEMBERSHIP_TRANSITIONS, from, event);
}

/**
 * الحالة كما يجب أن تُعرض: النشط يصير منتهيًا يوم `endsOn` لأنه حدّ غير مشمول.
 * لا كتابة للانتهاء في المرحلة 3، فالاشتقاق عند القراءة هو المرجع.
 */
export function effectiveMembershipStatus(
  status: MembershipStatus,
  endsOn: PlainDate | null,
  today: PlainDate,
): MembershipStatus {
  if (status !== "active") {
    return status;
  }
  if (endsOn === null) {
    // قيد CHECK في القاعدة يشترط التاريخين للنشط، فغيابهما خلل لا يُخمَّن
    throw new DomainError("invariant", "membership.active_without_end");
  }
  return comparePlainDates(today, endsOn) >= 0 ? "expired" : "active";
}
