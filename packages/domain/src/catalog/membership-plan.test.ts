import { describe, expect, it } from "vitest";
import { money } from "../money";
import {
  approximateMonthlyCost,
  bestValuePlan,
  durationShare,
  longestDuration,
  totalMonths,
  type MembershipPlan,
} from "./membership-plan";

function plan(overrides: Partial<MembershipPlan> = {}): MembershipPlan {
  return {
    slug: "p",
    name: { ar: "باقة", en: "Plan" },
    summary: { ar: "", en: "" },
    price: money(120000),
    paidMonths: 12,
    bonusMonths: 0,
    benefits: [],
    ...overrides,
  };
}

describe("totalMonths", () => {
  it("المدفوعة مع المجانية", () => {
    expect(totalMonths(plan({ paidMonths: 12, bonusMonths: 2 }))).toBe(14);
    expect(totalMonths(plan({ paidMonths: 1 }))).toBe(1);
  });
});

describe("approximateMonthlyCost", () => {
  it("يقسم السعر على كامل المدة ويقرّب لأقرب ريال", () => {
    expect(approximateMonthlyCost(plan())).toEqual(money(10000));
    expect(approximateMonthlyCost(plan({ price: money(100000), paidMonths: 3 }))).toEqual(
      money(33300),
    );
    expect(approximateMonthlyCost(plan({ price: money(200000), paidMonths: 3 }))).toEqual(
      money(66700),
    );
  });

  it("الأشهر المجانية تخفّض تكلفة الشهر", () => {
    // 1200 ريال على 14 شهرًا = 85.71 ⇒ 86
    expect(approximateMonthlyCost(plan({ bonusMonths: 2 }))).toEqual(money(8600));
  });

  it("تقريب واحد لا تقريبان: 1,025.94 على 12 شهرًا = 85.495 ⇒ 85 لا 86", () => {
    expect(approximateMonthlyCost(plan({ price: money(102594), paidMonths: 12 }))).toEqual(
      money(8500),
    );
    expect(approximateMonthlyCost(plan({ price: money(16899), paidMonths: 2 }))).toEqual(
      money(8400),
    );
  });

  it("باقة الشهر الواحد: تكلفة الشهر هي السعر", () => {
    expect(approximateMonthlyCost(plan({ price: money(35000), paidMonths: 1 }))).toEqual(
      money(35000),
    );
  });

  it("يرفض مدة غير موجبة بدل القسمة على صفر", () => {
    expect(() => approximateMonthlyCost(plan({ paidMonths: 0 }))).toThrow(/duration_not_positive/);
    expect(() => approximateMonthlyCost(plan({ paidMonths: 1.5 }))).toThrow(
      /duration_not_positive/,
    );
  });
});

describe("longestDuration و durationShare", () => {
  const plans = [
    plan({ paidMonths: 1 }),
    plan({ paidMonths: 6 }),
    plan({ paidMonths: 12, bonusMonths: 2 }),
  ];

  it("أطول مدة تشمل الأشهر المجانية", () => {
    expect(longestDuration(plans)).toBe(14);
    expect(longestDuration([])).toBe(0);
  });

  it("نسبة صحيحة من أطول مدة", () => {
    expect(durationShare(14, 14)).toBe(100);
    expect(durationShare(7, 14)).toBe(50);
    expect(durationShare(1, 12)).toBe(8);
    expect(durationShare(12, 14)).toBe(86);
  });

  it("لا تتجاوز 100 ولا تنزل عن 0", () => {
    expect(durationShare(20, 12)).toBe(100);
    expect(durationShare(0, 12)).toBe(0);
    expect(durationShare(3, 0)).toBe(0);
  });
});

describe("bestValuePlan", () => {
  it("الأقل تكلفة شهريًا، والأشهر المجانية تدخل في الحساب", () => {
    const monthly = plan({ slug: "m", price: money(35000), paidMonths: 1 });
    const half = plan({ slug: "h", price: money(160000), paidMonths: 6 });
    const year = plan({ slug: "y", price: money(280000), paidMonths: 12, bonusMonths: 2 });
    expect(bestValuePlan([monthly, half, year])?.slug).toBe("y");
    // بلا الأشهر المجانية السنوية 233 شهريًا، فتفوز باقة أرخص منها شهريًا إن وُجدت
    const cheapHalf = plan({ slug: "c", price: money(120000), paidMonths: 6 });
    expect(bestValuePlan([monthly, cheapHalf, year])?.slug).toBe("y");
    expect(
      bestValuePlan([monthly, plan({ slug: "x", price: money(110000), paidMonths: 6 }), year])
        ?.slug,
    ).toBe("x");
  });

  it("عند التعادل تُقدَّم الأطول مدة، أيًّا كان الترتيب", () => {
    const short = plan({ slug: "s", price: money(60000), paidMonths: 3 });
    const long = plan({ slug: "l", price: money(120000), paidMonths: 6 });
    expect(bestValuePlan([short, long])?.slug).toBe("l");
    expect(bestValuePlan([long, short])?.slug).toBe("l");
  });

  it("المقارنة صحيحة لا مقرَّبة: فرق أقل من هللة شهريًا يحسم", () => {
    // 100.00 ÷ 3 = 33.3333 مقابل 199.99 ÷ 6 = 33.3317: الثانية أرخص وإن تساوتا بعد التقريب للهللة
    const three = plan({ slug: "three", price: money(10000), paidMonths: 3 });
    const six = plan({ slug: "six", price: money(19999), paidMonths: 6 });
    expect(bestValuePlan([three, six])?.slug).toBe("six");
    expect(bestValuePlan([six, three])?.slug).toBe("six");
  });

  it("يرفض باقة بمدة غير موجبة بدل نتيجة خاطئة", () => {
    expect(() => bestValuePlan([plan({ slug: "a" }), plan({ slug: "b", paidMonths: 0 })])).toThrow(
      /duration_not_positive/,
    );
  });

  it("باقة واحدة هي الأفضل، ولا شيء عند غياب الباقات", () => {
    expect(bestValuePlan([plan({ slug: "only" })])?.slug).toBe("only");
    expect(bestValuePlan([])).toBeUndefined();
  });
});
