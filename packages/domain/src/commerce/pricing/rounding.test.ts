import { describe, expect, it } from "vitest";
import { DomainError } from "../../errors";
import { MAX_AMOUNT_MINOR } from "./limits";
import { allocateByLargestRemainder, mulDivHalfUp } from "./rounding";
import { seededRandom } from "./test-support";

function expectInvariant(run: () => unknown): void {
  expect(run).toThrow(DomainError);
  try {
    run();
  } catch (error) {
    expect((error as DomainError).code).toBe("invariant");
  }
}

describe("mulDivHalfUp", () => {
  it("النصف يُرفع وما دونه يُخفض", () => {
    expect(mulDivHalfUp(5, 1, 2)).toBe(3); // 2.5
    expect(mulDivHalfUp(12, 1, 5)).toBe(2); // 2.4
    expect(mulDivHalfUp(13, 1, 5)).toBe(3); // 2.6
    expect(mulDivHalfUp(99900, 1250, 10000)).toBe(12488); // 12487.5 من المثال 2
    expect(mulDivHalfUp(149900, 1500, 11500)).toBe(19552); // 19552.17 من المثال 1
  });

  it("القيم الحدّية 0 و1 وأقصى int4", () => {
    expect(mulDivHalfUp(0, 1500, 11500)).toBe(0);
    expect(mulDivHalfUp(1, 1, 2)).toBe(1);
    expect(mulDivHalfUp(1, 1, 3)).toBe(0);
    expect(mulDivHalfUp(MAX_AMOUNT_MINOR, 10000, 10000)).toBe(MAX_AMOUNT_MINOR);
    const exact = (2n * BigInt(MAX_AMOUNT_MINOR) * 1500n + 11500n) / 23000n;
    expect(mulDivHalfUp(MAX_AMOUNT_MINOR, 1500, 11500)).toBe(Number(exact));
  });

  it("السالب والكسر والمقام الصفري أو السالب ترمي invariant", () => {
    expectInvariant(() => mulDivHalfUp(-1, 1, 2));
    expectInvariant(() => mulDivHalfUp(1, -1, 2));
    expectInvariant(() => mulDivHalfUp(1.5, 1, 2));
    expectInvariant(() => mulDivHalfUp(1, 1, 0));
    expectInvariant(() => mulDivHalfUp(1, 1, -2));
    expectInvariant(() => mulDivHalfUp(1, 1, 0.5));
  });

  it("الناتج غير الآمن يرمي invariant", () => {
    expectInvariant(() => mulDivHalfUp(MAX_AMOUNT_MINOR, MAX_AMOUNT_MINOR, 1));
  });
});

describe("allocateByLargestRemainder", () => {
  it("المثال 3: الهللة الباقية للباقي الأكبر", () => {
    expect(allocateByLargestRemainder(10000, [34900, 15000, 9999])).toEqual([5827, 2504, 1669]);
  });

  it("المثال 4 (التراكم): الهللة للإضافة لأن باقيها أكبر", () => {
    expect(allocateByLargestRemainder(5000, [89910, 45000])).toEqual([3332, 1668]);
  });

  it("تعادل الباقي يذهب للموضع الأصغر", () => {
    expect(allocateByLargestRemainder(1, [1, 1])).toEqual([1, 0]);
    expect(allocateByLargestRemainder(2, [1, 1, 1])).toEqual([1, 1, 0]);
    expect(allocateByLargestRemainder(1, [0, 3, 3])).toEqual([0, 1, 0]);
  });

  it("الوزن الصفري لا يأخذ شيئًا", () => {
    expect(allocateByLargestRemainder(7, [0, 5, 0, 2])).toEqual([0, 5, 0, 2]);
  });

  it("مجموع أوزان صفري: مقبول للمبلغ الصفري، وخطأ invariant لغيره", () => {
    expect(allocateByLargestRemainder(0, [0, 0])).toEqual([0, 0]);
    expect(allocateByLargestRemainder(0, [])).toEqual([]);
    expectInvariant(() => allocateByLargestRemainder(1, [0, 0]));
    expectInvariant(() => allocateByLargestRemainder(1, []));
  });

  it("يرفض المبلغ أو الوزن السالب أو الكسري", () => {
    expectInvariant(() => allocateByLargestRemainder(-1, [1]));
    expectInvariant(() => allocateByLargestRemainder(1, [-1, 2]));
    expectInvariant(() => allocateByLargestRemainder(1, [0.5, 2]));
  });

  it("مسار BigInt عند حد int4: الضرب يتجاوز الحد الآمن والمجموع دقيق", () => {
    const shares = allocateByLargestRemainder(MAX_AMOUNT_MINOR, [
      MAX_AMOUNT_MINOR,
      MAX_AMOUNT_MINOR,
      1,
    ]);
    expect(shares.reduce((sum, share) => sum + share, 0)).toBe(MAX_AMOUNT_MINOR);
    // M = 2q+1 و W = 2M+1: باقي الكبيرين q+1، وباقي الوزن 1 هو M، فالهللة الباقية له
    expect(shares).toEqual([1073741823, 1073741823, 1]);
  });

  it("خصائص ببذرة ثابتة: المجموع = المبلغ، ولا حصة سالبة أو فوق وزنها", () => {
    const random = seededRandom(20261125);
    for (let round = 0; round < 2000; round += 1) {
      const weights = Array.from({ length: 1 + random(6) }, () =>
        random(4) === 0 ? 0 : random(MAX_AMOUNT_MINOR / 8),
      );
      const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
      const total = weightSum === 0 ? 0 : random(weightSum + 1);
      const shares = allocateByLargestRemainder(total, weights);
      expect(shares.reduce((sum, share) => sum + share, 0)).toBe(total);
      shares.forEach((share, index) => {
        expect(share).toBeGreaterThanOrEqual(0);
        expect(share).toBeLessThanOrEqual(weights[index] ?? 0);
      });
    }
  });
});
