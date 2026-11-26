import { money, type MembershipPlan } from "@masar/domain";
import { describe, expect, it } from "vitest";
import { costRows } from "./cost-per-visit-view";

function plan(
  slug: string,
  amountMinor: number,
  paidMonths: number,
  bonusMonths = 0,
): MembershipPlan {
  return {
    slug,
    name: { ar: slug, en: slug },
    tier: null,
    summary: { ar: "", en: "" },
    price: money(amountMinor),
    paidMonths,
    bonusMonths,
    benefits: [],
  };
}

describe("costRows", () => {
  it("صف لكل اشتراك بتكلفة الزيارة والسعر الإجمالي والأوفر معلَّم", () => {
    const rows = costRows(
      [plan("one-month", 35_000, 1), plan("one-year", 280_000, 12, 2)],
      3,
      "ar",
    );
    expect(
      rows.map((row) => [row.slug, row.perVisit.amount, row.total.amount, row.isBestValue]),
    ).toEqual([
      ["one-month", "27", "350", false],
      ["one-year", "15", "2,800", true],
    ]);
    expect(rows[1]?.href).toBe("/memberships/one-year");
  });

  it("بلا اشتراكات ⇒ لا صفوف", () => {
    expect(costRows([], 3, "en")).toEqual([]);
  });
});
