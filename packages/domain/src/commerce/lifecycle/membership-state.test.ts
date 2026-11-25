import { describe, expect, it } from "vitest";
import {
  MEMBERSHIP_EVENTS,
  MEMBERSHIP_STATUSES,
  MEMBERSHIP_TRANSITIONS,
  TERMINAL_MEMBERSHIP_STATUSES,
  effectiveMembershipStatus,
  nextMembershipStatus,
  type MembershipEvent,
  type MembershipStatus,
} from "./membership-state";
import { plainDate } from "./plain-date";

/** المتوقَّع لكل زوج: حالة تالية، أو سياسة حاجبة؛ وما سواهما انتقال غير صالح. */
const EXPECTED: Record<string, MembershipStatus | `policy.undecided.${string}`> = {
  "scheduled/start_confirmed": "policy.undecided.renewal_start",
  "active/freeze": "policy.undecided.freeze_rules",
  "frozen/unfreeze": "policy.undecided.freeze_rules",
  "active/period_ended": "expired",
  "scheduled/cancel": "policy.undecided.cancellation_rules",
  "active/cancel": "policy.undecided.cancellation_rules",
  "frozen/cancel": "policy.undecided.cancellation_rules",
};

const PAIRS = MEMBERSHIP_STATUSES.flatMap((status) =>
  MEMBERSHIP_EVENTS.map((event): [MembershipStatus, MembershipEvent] => [status, event]),
);

describe("nextMembershipStatus", () => {
  it.each(PAIRS)("مسح شامل: %s عند %s", (status, event) => {
    const expected = EXPECTED[`${status}/${event}`];
    const result = nextMembershipStatus(status, event);
    if (expected === undefined) {
      expect(result.ok ? null : result.error.reason).toBe("membership.invalid_transition");
    } else if (expected.startsWith("policy.")) {
      expect(result.ok ? null : [result.error.code, result.error.reason]).toEqual([
        "conflict",
        expected,
      ]);
    } else {
      expect(result).toEqual({ ok: true, value: expected });
    }
  });

  it("الحالات النهائية لا خروج منها ولا ترقية", () => {
    for (const status of TERMINAL_MEMBERSHIP_STATUSES) {
      expect(MEMBERSHIP_TRANSITIONS.some((t) => t.from === status)).toBe(false);
    }
  });
});

describe("effectiveMembershipStatus", () => {
  const endsOn = plainDate(2027, 3, 1);

  it("اليوم السابق لـendsOn ما زال نشطًا", () => {
    expect(effectiveMembershipStatus("active", endsOn, plainDate(2027, 2, 28))).toBe("active");
  });

  it("يوم endsOn منتهٍ لأنه حدّ غير مشمول", () => {
    expect(effectiveMembershipStatus("active", endsOn, endsOn)).toBe("expired");
  });

  it("غير النشط لا يتغير بالتاريخ", () => {
    expect(effectiveMembershipStatus("frozen", endsOn, plainDate(2030, 1, 1))).toBe("frozen");
    expect(effectiveMembershipStatus("scheduled", null, plainDate(2030, 1, 1))).toBe("scheduled");
  });

  it("النشط بلا endsOn خلل يرمي invariant", () => {
    expect(() => effectiveMembershipStatus("active", null, endsOn)).toThrow(
      "membership.active_without_end",
    );
  });
});
