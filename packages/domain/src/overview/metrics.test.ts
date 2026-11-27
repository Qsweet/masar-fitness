import { describe, expect, it } from "vitest";
import { orderFunnel } from "./funnel";
import {
  averageMinor,
  bucketSums,
  completionBps,
  percentDelta,
  pointsDelta,
  topShares,
} from "./metrics";

describe("الفرق عن الفترة السابقة", () => {
  it("بأعشار النسبة، وسهم الاتجاه", () => {
    expect(percentDelta(38_262, 33_190)).toEqual({ direction: "up", tenths: 153 });
    expect(percentDelta(30, 40)).toEqual({ direction: "down", tenths: 250 });
  });

  it("يُخفى حين السابقة صفر أو لا فرق (القرار 64-8)", () => {
    expect(percentDelta(5, 0)).toBeNull();
    expect(percentDelta(7, 7)).toBeNull();
    expect(percentDelta(100_001, 100_000)).toBeNull();
  });

  it("نسبة الإتمام بنقاط الأساس، وفرقها بالنقاط لا بالنسبة", () => {
    expect(completionBps(52, 38)).toBe(7308);
    expect(completionBps(0, 0)).toBeNull();
    expect(completionBps(3, 5)).toBe(10_000);
    expect(pointsDelta(7310, 7080)).toEqual({ direction: "up", tenths: 23 });
    expect(pointsDelta(5000, null)).toBeNull();
    expect(pointsDelta(5000, 5004)).toBeNull();
  });
});

describe("التجميع والحصص", () => {
  it("أسبوعي من يومي، والأخير قد يقصر", () => {
    expect(bucketSums([1, 2, 3, 4, 5, 6, 7, 8, 9], 7)).toEqual([28, 17]);
    expect(bucketSums([], 7)).toEqual([]);
  });

  it("أكبر أربع و«غيرها»، والحصص تجمع 100%", () => {
    const rows = [10, 50, 20, 5, 15, 1].map((amount, index) => ({
      item: `p${String(index)}`,
      amount,
      count: 1,
    }));
    const shares = topShares(rows, 4);
    expect(shares.map((share) => share.item)).toEqual(["p1", "p2", "p4", "p0", null]);
    expect(shares.at(-1)).toMatchObject({ amount: 6, count: 2 });
    expect(shares.reduce((sum, share) => sum + share.bps, 0)).toBe(10_000);
  });

  it("خمس فئات بالضبط لا تُجمع، والمجموع صفر حصصه صفر", () => {
    const rows = [1, 2, 3, 4, 5].map((amount) => ({ item: amount, amount, count: 1 }));
    expect(topShares(rows, 4)).toHaveLength(5);
    expect(topShares([{ item: "x", amount: 0, count: 0 }], 4)[0]?.bps).toBe(0);
  });

  it("متوسط الطلب بالهللة", () => {
    expect(averageMinor(38_262_00, 38)).toBe(100_689);
    expect(averageMinor(0, 0)).toBeNull();
  });
});

describe("قمع الطلب إلى الدفع", () => {
  it("الخطوات والفاقد وأسبابه", () => {
    const funnel = orderFunnel({ created: 52, attempted: 44, paid: 38, failed: 4, expired: 2 });
    expect(funnel.steps.map((step) => step.count)).toEqual([52, 44, 38]);
    expect(funnel.steps[2].bps).toBe(7308);
    expect(funnel.drops[0]).toMatchObject({ lost: 8, bps: 1538 });
    expect(funnel.drops[1]).toMatchObject({ lost: 6, bps: 1364, failed: 4, expired: 2, other: 0 });
  });

  it("لا خطوة تزيد على سابقتها، والأسباب لا تتجاوز الفاقد", () => {
    const funnel = orderFunnel({ created: 3, attempted: 5, paid: 4, failed: 9, expired: 9 });
    expect(funnel.steps.map((step) => step.count)).toEqual([3, 3, 3]);
    expect(funnel.drops[1]).toMatchObject({ lost: 0, failed: 0, expired: 0, other: 0 });
  });

  it("بلا طلبات: كل شيء صفر بلا قسمة على صفر", () => {
    const funnel = orderFunnel({ created: 0, attempted: 0, paid: 0, failed: 0, expired: 0 });
    expect(funnel.steps.every((step) => step.bps === 0)).toBe(true);
    expect(funnel.drops[1].bps).toBe(0);
  });
});
