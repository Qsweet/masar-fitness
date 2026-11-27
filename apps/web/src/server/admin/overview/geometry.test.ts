import type { PeriodDay } from "@masar/db";
import { describe, expect, it } from "vitest";
import { readingOrder, revenueChart, sparkline } from "./geometry";
import { periodSummary } from "./summary";

const box = { width: 300, height: 100, gapRatio: 0.5 };

describe("رسم الإيراد بالفترتين", () => {
  it("الأقدم في جهة البداية (يمين اللوحة)، والمقياس يشمل السابقة", () => {
    const chart = revenueChart([10, 20, 30], [40, 0, 0], box);
    expect(chart.max).toBe(40);
    // الأحدث (30) أولًا من اليسار في SVG
    expect(chart.bars.map((bar) => bar.value)).toEqual([30, 20, 10]);
    expect(chart.bars[0]?.height).toBe(75);
    // السابقة معكوسة كذلك: قمتها (40) عند الأقدم، أي يمينًا
    expect(chart.compare).toBe("50,100 150,100 250,0");
    expect(chart.labelled).toEqual([0, 1, 2]);
  });

  it("بلا فترة سابقة لا خط، وبلا أعمدة لا تسميات", () => {
    expect(revenueChart([5], [], box).compare).toBe("");
    expect(revenueChart([], [], box).labelled).toEqual([]);
  });

  it("التسميات: الأقدم والأوسط والأحدث بلا تكرار", () => {
    expect(revenueChart([1, 2], [], box).labelled).toEqual([0, 1]);
    expect(
      revenueChart(
        Array.from({ length: 30 }, () => 1),
        [],
        box,
      ).labelled,
    ).toEqual([0, 14, 29]);
  });
});

describe("الخط الصغير بالمقارنة", () => {
  it("مقياس مشترك، والمساحة مغلقة على القاعدة", () => {
    const spark = sparkline([0, 10], [20, 20], 100, 20);
    expect(spark.line).toBe("2,10 98,18");
    expect(spark.compare).toBe("2,2 98,2");
    expect(spark.area).toBe("2,20 2,10 98,18 98,20");
    expect(readingOrder([1, 2, 3])).toEqual([3, 2, 1]);
  });
});

function day(index: number, revenueMinor: number, created = 0, createdPaid = 0): PeriodDay {
  return {
    day: `2026-11-${String(index + 1).padStart(2, "0")}`,
    revenueMinor,
    paid: revenueMinor > 0 ? 1 : 0,
    created,
    createdPaid,
  };
}

describe("ملخص الفترة", () => {
  it("المجاميع والفروق والإتمام بالنقاط", () => {
    const summary = periodSummary(
      [day(0, 30_000, 4, 3), day(1, 15_000, 4, 3)],
      [day(0, 15_000, 4, 2), day(1, 15_000, 4, 3)],
    );
    expect(summary.revenue).toMatchObject({
      value: 45_000,
      previous: 30_000,
      delta: { direction: "up", tenths: 500 },
      trend: [30_000, 15_000],
    });
    expect(summary.paid.delta).toBeNull();
    expect(summary.completion).toMatchObject({
      value: 7500,
      previous: 6250,
      delta: { direction: "up", tenths: 125 },
    });
    expect(summary.bars).toEqual({ unit: "day", values: [30_000, 15_000] });
  });

  it("أكثر من 90 يومًا: أعمدة أسبوعية، وبلا طلبات لا نسبة إتمام", () => {
    const long = Array.from({ length: 98 }, (_, index) => day(index % 28, 100));
    const summary = periodSummary(long, []);
    expect(summary.bars.unit).toBe("week");
    expect(summary.bars.values).toHaveLength(14);
    expect(summary.bars.values[0]).toBe(700);
    expect(summary.completion.value).toBeNull();
    expect(summary.revenue.delta).toBeNull();
  });
});
