import { describe, expect, it } from "vitest";
import { decideMembershipStart, isLiveMembership, membershipPeriod } from "./membership-period";
import { formatPlainDate, plainDate } from "./plain-date";

const PAID_ON = plainDate(2027, 1, 31);
const TODAY = plainDate(2027, 3, 1);

describe("membershipPeriod", () => {
  it("تضم الأشهر المجانية، وendsOn حدّ غير مشمول بقصّ آخر الشهر", () => {
    const period = membershipPeriod(PAID_ON, 3, 1);
    expect(period.startsOn).toBe(PAID_ON);
    expect(formatPlainDate(period.endsOn)).toBe("2027-05-31");
  });

  it("بلا أشهر مجانية", () => {
    expect(formatPlainDate(membershipPeriod(PAID_ON, 1, 0).endsOn)).toBe("2027-02-28");
  });

  it.each([
    [0, 0, "membership.invalid_paid_months"],
    [-1, 0, "membership.invalid_paid_months"],
    [1.5, 0, "membership.invalid_paid_months"],
    [3, -1, "membership.invalid_bonus_months"],
    [3, 0.5, "membership.invalid_bonus_months"],
  ])("أشهر غير صالحة (%s مدفوع، %s مجاني) ترمي invariant", (paid, bonus, reason) => {
    expect(() => membershipPeriod(PAID_ON, paid, bonus)).toThrow(reason);
  });
});

describe("decideMembershipStart", () => {
  const base = { paidOn: PAID_ON, paidMonths: 3, bonusMonths: 1, hasLiveMembership: false };

  it("on_payment بلا اشتراك حي ⇒ نشط من تاريخ الدفع", () => {
    const decision = decideMembershipStart({ ...base, rule: "on_payment" });
    expect(decision).toEqual({
      status: "active",
      startsOn: PAID_ON,
      endsOn: plainDate(2027, 5, 31),
    });
  });

  it("on_first_visit ⇒ مجدول بانتظار أول زيارة بلا تواريخ", () => {
    expect(decideMembershipStart({ ...base, rule: "on_first_visit" })).toEqual({
      status: "scheduled",
      reason: "awaiting_first_visit",
    });
  });

  it.each(["on_payment", "on_first_visit"] as const)(
    "اشتراك حي مع %s ⇒ مجدول لأن قاعدة التجديد غير محسومة",
    (rule) => {
      expect(decideMembershipStart({ ...base, rule, hasLiveMembership: true })).toEqual({
        status: "scheduled",
        reason: "renewal_rule_undecided",
      });
    },
  );

  it("أشهر غير صالحة ترمي invariant ولو كان القرار مجدولًا", () => {
    expect(() => decideMembershipStart({ ...base, rule: "on_first_visit", paidMonths: 0 })).toThrow(
      "membership.invalid_paid_months",
    );
  });
});

describe("isLiveMembership", () => {
  it.each([
    ["scheduled", null, true],
    ["frozen", plainDate(2027, 2, 1), true],
    ["active", plainDate(2027, 3, 2), true],
    ["active", TODAY, false],
    ["active", plainDate(2027, 2, 28), false],
    ["expired", plainDate(2027, 5, 1), false],
    ["cancelled", null, false],
  ] as const)("%s ينتهي %o ⇒ %s", (status, endsOn, live) => {
    expect(isLiveMembership({ status, endsOn }, TODAY)).toBe(live);
  });
});
