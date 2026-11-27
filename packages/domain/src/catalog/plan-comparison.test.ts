import { describe, expect, it } from "vitest";
import { DomainError } from "../errors";
import { money } from "../money";
import type { MembershipPlan } from "./membership-plan";
import { MAX_STRIP_MONTHS, monthlyComparison, monthStrip, shortestPlan } from "./plan-comparison";

const POOL = { ar: "المسبح", en: "Pool" };

function plan(slug: string, amountMinor: number, paidMonths: number, bonusMonths = 0) {
  const value: MembershipPlan = {
    slug,
    name: { ar: slug, en: slug },
    tier: null,
    summary: { ar: "", en: "" },
    price: money(amountMinor),
    paidMonths,
    bonusMonths,
    benefits: [POOL],
  };
  return value;
}

/** أسعار بذرة المعاينة: 699 على 3+1، و999 على 6+2، و1,499 على 12+2. */
const quarter = plan("three", 69_900, 3, 1);
const half = plan("six", 99_900, 6, 2);
const annual = plan("twelve", 149_900, 12, 2);
const catalog = [quarter, half, annual];

describe("monthStrip", () => {
  it("المدفوعة ثم المجانية كما في الكتالوج", () => {
    expect(monthStrip(annual)).toEqual({ paid: 12, free: 2 });
    expect(monthStrip(quarter)).toEqual({ paid: 3, free: 1 });
    expect(monthStrip(plan("p", 1, 6))).toEqual({ paid: 6, free: 0 });
  });

  it("لا شريط لشهر واحد ولا لما يتجاوز الحد", () => {
    expect(monthStrip(plan("one", 1, 1))).toBeUndefined();
    expect(monthStrip(plan("max", 1, MAX_STRIP_MONTHS - 2, 2))).toEqual({
      paid: MAX_STRIP_MONTHS - 2,
      free: 2,
    });
    expect(monthStrip(plan("long", 1, MAX_STRIP_MONTHS, 1))).toBeUndefined();
  });

  it("مدة غير صحيحة خطأ ثابت", () => {
    expect(() => monthStrip({ paidMonths: 0, bonusMonths: 1 })).toThrow(DomainError);
    expect(() => monthStrip({ paidMonths: 2.5, bonusMonths: 0 })).toThrow(DomainError);
    expect(() => monthStrip({ paidMonths: 3, bonusMonths: -1 })).toThrow(DomainError);
  });
});

describe("shortestPlan", () => {
  it("الأقصر مدة كاملة، والأول عند التعادل التام، ولا شيء لقائمة فارغة", () => {
    expect(shortestPlan([annual, quarter, half])?.slug).toBe("three");
    expect(shortestPlan([plan("a", 1, 3, 1), plan("b", 1, 4)])?.slug).toBe("a");
    expect(shortestPlan([])).toBeUndefined();
  });

  it("من المتساوية مدةً الأرخص شهريًا، لا الأغلى الذي يضخّم التوفير", () => {
    const dear = plan("dear", 99_900, 4);
    const cheap = plan("cheap", 69_900, 3, 1);
    expect(shortestPlan([dear, cheap, annual])?.slug).toBe("cheap");
    expect(monthlyComparison(annual, [dear, cheap, annual])?.referenceMonthly).toEqual(
      money(17_500),
    );
  });
});

describe("monthlyComparison", () => {
  it("السنوي مقابل الأقصر: 107 ر.س شهريًا بدل 175 ر.س (التقريب المعروض نفسه)", () => {
    const comparison = monthlyComparison(annual, catalog);
    expect(comparison?.monthly).toEqual(money(10_700));
    expect(comparison?.referenceMonthly).toEqual(money(17_500));
    expect(comparison?.reference.slug).toBe("three");
    expect(monthlyComparison(half, catalog)?.monthly).toEqual(money(12_500));
  });

  it("لا مقارنة للمرجع نفسه ولا لاشتراك وحيد", () => {
    expect(monthlyComparison(quarter, catalog)).toBeUndefined();
    expect(monthlyComparison(annual, [annual])).toBeUndefined();
  });

  it("لا مقارنة حين لا يكون الشهر أرخص بعد التقريب", () => {
    // 3,000 ر.س على 12 شهرًا = 250 ر.س شهريًا، أغلى من 175
    const dearer = plan("dear", 300_000, 12);
    expect(monthlyComparison(dearer, [quarter, dearer])).toBeUndefined();
    // 1,398 ر.س على 8 أشهر = 174.75 ⇒ 175 بعد التقريب: لا فرق يُعرض
    const same = plan("same", 139_800, 8);
    expect(monthlyComparison(same, [quarter, same])).toBeUndefined();
  });

  it("لا مقارنة حين تختلف المزايا: الفرق حينها ليس في المدة وحدها", () => {
    const extra = { ...annual, benefits: [POOL, { ar: "الساونا", en: "Sauna" }] };
    expect(monthlyComparison(extra, [quarter, extra])).toBeUndefined();
    const none = { ...annual, benefits: [] };
    expect(monthlyComparison(none, [{ ...quarter, benefits: [] }, none])).toBeUndefined();
  });

  it("الفرق الحقيقي قبل التقريب ريال على الأقل", () => {
    // المرجع 699 ÷ 4 = 174.75 (يُعرض 175). 1,392 ÷ 8 = 174.00: يبدو فرق ريال والحقيقي 75 هللة
    const close = plan("close", 139_200, 8);
    expect(monthlyComparison(close, [quarter, close])).toBeUndefined();
    // 1,390 ÷ 8 = 173.75: فرق ريال كامل بالضبط
    const exact = plan("exact", 139_000, 8);
    expect(monthlyComparison(exact, [quarter, exact])?.monthly).toEqual(money(17_400));
  });

  it("لا مقارنة لمدة مساوية للمرجع حتى بسعر أقل", () => {
    const cheaperSameLength = plan("cheap", 50_000, 4);
    expect(monthlyComparison(cheaperSameLength, [quarter, cheaperSameLength])).toBeUndefined();
  });
});
