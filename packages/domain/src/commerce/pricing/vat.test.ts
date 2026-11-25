import { describe, expect, it } from "vitest";
import { DomainError } from "../../errors";
import { money } from "../../money";
import { basisPoints, vatIncludedIn } from "./vat";

const STANDARD_RATE = basisPoints(1500);

describe("vatIncludedIn", () => {
  it("الأمثلة الأربعة هللةً بهللة", () => {
    const cases: readonly (readonly [number, number])[] = [
      [149900, 19552], // المثال 1
      [87412, 11402], // المثال 2: الباقة بعد الخصم
      [45000, 5870], // المثالان 2 و4: الإضافة
      [29073, 3792], // المثال 3
      [12496, 1630],
      [8330, 1087],
      [89910, 11727], // المثال 4: الافتراضي
      [86578, 11293], // المثال 4: التراكم
      [43332, 5652],
    ];
    for (const [gross, vat] of cases) {
      expect(vatIncludedIn(money(gross), STANDARD_RATE)).toEqual(money(vat));
    }
  });

  it("نسبة صفرية تعطي صفرًا، ومبلغ صفري يعطي صفرًا", () => {
    expect(vatIncludedIn(money(149900), basisPoints(0))).toEqual(money(0));
    expect(vatIncludedIn(money(0), STANDARD_RATE)).toEqual(money(0));
  });

  it("المبلغ السالب عطل (invariant)", () => {
    expect(() => vatIncludedIn(money(-1), STANDARD_RATE)).toThrow(DomainError);
  });
});

describe("basisPoints", () => {
  it("يقبل الطرفين 0 و10000", () => {
    expect(basisPoints(0)).toBe(0);
    expect(basisPoints(10000)).toBe(10000);
  });

  it("يرفض السالب والكسر وما فوق 10000", () => {
    for (const bad of [-1, 1.5, 10001, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => basisPoints(bad)).toThrow(/basis_points.out_of_range/);
    }
  });
});
