import { describe, expect, it } from "vitest";
import type { MembershipPlan } from "../catalog/membership-plan";
import { DomainError } from "../errors";
import { money } from "../money";
import {
  costPerVisit,
  DEFAULT_VISITS_PER_WEEK,
  MAX_VISITS_PER_WEEK,
  MIN_VISITS_PER_WEEK,
  parseVisitsPerWeek,
} from "./cost-per-visit";

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

describe("costPerVisit", () => {
  it("سنة بزيارة أسبوعيًا: السعر ÷ 52 زيارة", () => {
    // 5200 ر.س على 52 زيارة = 100 ر.س تمامًا
    expect(costPerVisit(plan(520_000, 12), 1)).toEqual(money(10_000));
  });

  it("يحسب كامل المدة مع الأشهر المجانية", () => {
    // 2800 ر.س × 12 ÷ (14 × 52 × 3) = 15.38... ر.س
    expect(costPerVisit(plan(280_000, 12, 2), 3)).toEqual(money(1_538));
  });

  it("شهر بزيارة كل يوم: 52/12 أسبوعًا × 7", () => {
    // 350 ر.س × 12 ÷ (1 × 52 × 7) = 11.538... ⇒ 11.54
    expect(costPerVisit(plan(35_000, 1), 7)).toEqual(money(1_154));
  });

  it("تقريب واحد في النهاية لأقرب هللة، والنصف يُقرَّب للأعلى", () => {
    // 13 هللة × 12 ÷ (1 × 52 × 1) = 3 هللات بالضبط
    expect(costPerVisit(plan(13, 1), 1)).toEqual(money(3));
    // 1 هللة × 12 ÷ 52 = 0.23 ⇒ 0
    expect(costPerVisit(plan(1, 1), 1)).toEqual(money(0));
    // 26 × 12 ÷ (1 × 52 × 4) = 1.5 ⇒ 2 (نصف للأعلى)
    expect(costPerVisit(plan(26, 1), 4)).toEqual(money(2));
  });

  it("النتيجة عدد صحيح دائمًا وتتناقص بزيادة الزيارات", () => {
    const year = plan(280_000, 12, 2);
    const costs = [1, 2, 3, 4, 5, 6, 7].map((visits) => costPerVisit(year, visits).amountMinor);
    costs.forEach((cost) => {
      expect(Number.isInteger(cost)).toBe(true);
    });
    expect([...costs].sort((a, b) => b - a)).toEqual(costs);
  });

  it("السعر صفر ⇒ صفر", () => {
    expect(costPerVisit(plan(0, 3), 3)).toEqual(money(0));
  });

  it("يرفض عدد زيارات خارج الحدود أو غير صحيح", () => {
    for (const visits of [0, 8, -1, 2.5, Number.NaN]) {
      expect(() => costPerVisit(plan(10_000, 1), visits)).toThrow(DomainError);
    }
  });

  it("يرفض مدة غير موجبة وسعرًا سالبًا وتجاوز الأعداد الآمنة", () => {
    expect(() => costPerVisit(plan(10_000, 0), 3)).toThrow(DomainError);
    expect(() => costPerVisit(plan(-100, 1), 3)).toThrow(DomainError);
    expect(() => costPerVisit(plan(Number.MAX_SAFE_INTEGER, 1), 3)).toThrow(DomainError);
  });
});

describe("parseVisitsPerWeek", () => {
  it("يقبل رقمًا واحدًا من 1 إلى 7", () => {
    for (let visits = MIN_VISITS_PER_WEEK; visits <= MAX_VISITS_PER_WEEK; visits++) {
      expect(parseVisitsPerWeek(String(visits))).toBe(visits);
    }
  });

  it("أي قيمة أخرى ترجع الافتراضية بلا خطأ", () => {
    for (const raw of [
      undefined,
      "",
      "0",
      "8",
      "10",
      "03",
      "3.0",
      " 3",
      "3 ",
      "abc",
      "-3",
      "+3",
      "1e0",
      "٣",
      "Infinity",
    ]) {
      expect(parseVisitsPerWeek(raw), String(raw)).toBe(DEFAULT_VISITS_PER_WEEK);
    }
  });

  it("المعامل المكرر (‎?visits=2&visits=5‎) يرجع الافتراضية", () => {
    expect(parseVisitsPerWeek(["2", "5"])).toBe(DEFAULT_VISITS_PER_WEEK);
  });
});
