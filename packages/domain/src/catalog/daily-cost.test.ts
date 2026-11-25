import { describe, expect, it } from "vitest";
import { money } from "../money";
import { approximateDailyCost } from "./daily-cost";
import type { MembershipPlan } from "./membership-plan";

function plan(amountMinor: number, paidMonths: number, bonusMonths = 0): MembershipPlan {
  return {
    slug: "p",
    name: { ar: "باقة", en: "Plan" },
    summary: { ar: "", en: "" },
    price: money(amountMinor),
    paidMonths,
    bonusMonths,
    benefits: [],
  };
}

describe("approximateDailyCost", () => {
  it("سنة كاملة: السعر ÷ 365 يومًا", () => {
    expect(approximateDailyCost(plan(365_000, 12))).toEqual(money(1_000));
  });

  it("يحسب الأشهر المجانية ضمن الأيام: 699 ر.س على 3+1 أشهر", () => {
    // 69900 × 12 ÷ (4 × 365) = 574.52… ⇒ 575 هللة
    expect(approximateDailyCost(plan(69_900, 3, 1))).toEqual(money(575));
  });

  it("تقريب واحد لأقرب هللة: 999 ر.س على 6+2 و1,499 ر.س على 12+2", () => {
    // 99900 × 12 ÷ 2920 = 410.54… ⇒ 411؛ 149900 × 12 ÷ 5110 = 352.01… ⇒ 352
    expect(approximateDailyCost(plan(99_900, 6, 2))).toEqual(money(411));
    expect(approximateDailyCost(plan(149_900, 12, 2))).toEqual(money(352));
  });

  it("النصف يُقرَّب للأعلى", () => {
    // 73 × 12 ÷ 365 = 2.4 ⇒ 2؛ 365 × 12 ÷ (8 × 365) = 1.5 ⇒ 2
    expect(approximateDailyCost(plan(73, 1))).toEqual(money(2));
    expect(approximateDailyCost(plan(365, 8))).toEqual(money(2));
  });

  it("يرفض المدة غير الموجبة والسعر السالب", () => {
    expect(() => approximateDailyCost(plan(1_000, 0))).toThrow(/duration_not_positive/);
    expect(() => approximateDailyCost(plan(-1, 1))).toThrow(/negative_price/);
  });
});
