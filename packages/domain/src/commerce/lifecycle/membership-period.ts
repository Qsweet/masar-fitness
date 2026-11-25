import { DomainError } from "../../errors";
import { effectiveMembershipStatus, type MembershipStatus } from "./membership-state";
import { addMonthsClamped, type PlainDate } from "./plain-date";

/** قاعدة بدء الاشتراك كما تُختم على سطر الطلب (enum القاعدة `membership_start_rule`). */
export const MEMBERSHIP_START_RULES = ["on_payment", "on_first_visit"] as const;

export type MembershipStartRule = (typeof MEMBERSHIP_START_RULES)[number];

export interface MembershipPeriod {
  readonly startsOn: PlainDate;
  /** حدّ غير مشمول: آخر يوم في الاشتراك هو اليوم السابق له. */
  readonly endsOn: PlainDate;
}

/** مدة الاشتراك تضم الأشهر المدفوعة والمجانية معًا. */
export function membershipPeriod(
  startsOn: PlainDate,
  paidMonths: number,
  bonusMonths: number,
): MembershipPeriod {
  if (!Number.isSafeInteger(paidMonths) || paidMonths <= 0) {
    throw new DomainError("invariant", "membership.invalid_paid_months");
  }
  if (!Number.isSafeInteger(bonusMonths) || bonusMonths < 0) {
    throw new DomainError("invariant", "membership.invalid_bonus_months");
  }
  return { startsOn, endsOn: addMonthsClamped(startsOn, paidMonths + bonusMonths) };
}

export interface MembershipStartInput {
  readonly rule: MembershipStartRule;
  /** تاريخ الدفع بتوقيت النادي. */
  readonly paidOn: PlainDate;
  readonly hasLiveMembership: boolean;
  readonly paidMonths: number;
  readonly bonusMonths: number;
}

export type MembershipStartDecision =
  | ({ readonly status: "active" } & MembershipPeriod)
  | {
      readonly status: "scheduled";
      readonly reason: "awaiting_first_visit" | "renewal_rule_undecided";
    };

/**
 * حالة الاشتراك عند تسليم الطلب. للعميل اشتراك حي ⇒ مجدول بلا تواريخ، لأن بدء التجديد
 * غير محسوم (ويُقدَّم على أول زيارة لأن تأكيد البدء نفسه محجوب به). لا تاريخ مخترع ولا تراكب.
 */
export function decideMembershipStart(input: MembershipStartInput): MembershipStartDecision {
  const period = membershipPeriod(input.paidOn, input.paidMonths, input.bonusMonths);
  if (input.hasLiveMembership) {
    return { status: "scheduled", reason: "renewal_rule_undecided" };
  }
  if (input.rule === "on_first_visit") {
    return { status: "scheduled", reason: "awaiting_first_visit" };
  }
  return { status: "active", ...period };
}

const LIVE_STATUSES: readonly MembershipStatus[] = ["scheduled", "active", "frozen"];

/** «اشتراك حي»: مجدول أو مجمَّد، أو نشط ولم يبلغ `endsOn`. */
export function isLiveMembership(
  membership: { readonly status: MembershipStatus; readonly endsOn: PlainDate | null },
  today: PlainDate,
): boolean {
  return LIVE_STATUSES.includes(
    effectiveMembershipStatus(membership.status, membership.endsOn, today),
  );
}
