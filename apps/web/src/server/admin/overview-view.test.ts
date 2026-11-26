import type { AuditRow, DailyOrders } from "@masar/db";
import { describe, expect, it } from "vitest";
import { getAdminDictionary } from "@/i18n/admin";
import {
  activityItem,
  barChart,
  deltaFromYesterday,
  kpiOf,
  niceAxisMax,
  relativeTime,
  sparklinePoints,
} from "./overview-view";

describe("أعلى المحور", () => {
  it.each([
    [0, 4],
    [3, 4],
    [4, 4],
    [5, 6],
    [7, 8],
    [9, 10],
    [10, 20],
    [11, 20],
    [35, 40],
    [81, 100],
    [100, 200],
    [450, 600],
  ])("%i ← %i", (value, expected) => {
    expect(niceAxisMax(value)).toBe(expected);
    expect(Number.isInteger(niceAxisMax(value) / 2)).toBe(true);
    expect(niceAxisMax(value)).toBeGreaterThanOrEqual(value);
  });
});

describe("هندسة الأعمدة", () => {
  const box = { width: 400, height: 100, gapRatio: 0.5 };

  it("الارتفاع بنسبة القيمة إلى أعلى المحور، والعمود على القاعدة", () => {
    const chart = barChart([0, 2, 4, 1], box);
    expect(chart.max).toBe(4);
    expect(chart.bars.map((bar) => bar.height)).toEqual([0, 50, 100, 25]);
    expect(chart.bars.every((bar) => bar.y + bar.height === box.height)).toBe(true);
  });

  it("الأعمدة متساوية العرض في خانات متساوية، بلا تداخل ولا خروج عن اللوحة", () => {
    const { bars } = barChart([1, 2, 3, 4], box);
    expect(bars.map((bar) => bar.x)).toEqual([25, 125, 225, 325]);
    expect(bars.every((bar) => bar.width === 50)).toBe(true);
    expect((bars.at(-1)?.x ?? 0) + 50).toBeLessThanOrEqual(box.width);
  });

  it("خطوط الشبكة عند الصفر والمنتصف والأعلى", () => {
    expect(barChart([7], box).ticks).toEqual([
      { value: 0, y: 100 },
      { value: 4, y: 50 },
      { value: 8, y: 0 },
    ]);
  });

  it("قيمة موجبة صغيرة جدًّا تبقى مرئية، والصفر بلا عمود", () => {
    const { bars } = barChart([1, 0, 900], box);
    expect(bars[0]?.height).toBe(2);
    expect(bars[1]?.height).toBe(0);
  });

  it("سلسلة فارغة بلا أعمدة", () => {
    expect(barChart([], box).bars).toEqual([]);
  });
});

describe("الخط الصغير", () => {
  it("من القاعدة إلى القمة داخل الهامش، بالترتيب", () => {
    expect(sparklinePoints([0, 5, 10], 100, 20)).toBe("2,18 50,10 98,2");
  });

  it("سلسلة كلها أصفار خط على القاعدة", () => {
    expect(sparklinePoints([0, 0, 0], 100, 20)).toBe("2,18 50,18 98,18");
  });

  it("قيمة واحدة نقطة واحدة", () => {
    expect(sparklinePoints([3], 100, 20)).toBe("2,2");
  });
});

describe("الفرق عن أمس", () => {
  it("يُعرض حين يكون له معنى فقط", () => {
    expect(deltaFromYesterday(3, 2)).toEqual({ direction: "up", percent: 50 });
    expect(deltaFromYesterday(1, 4)).toEqual({ direction: "down", percent: 75 });
    expect(deltaFromYesterday(0, 5)).toEqual({ direction: "down", percent: 100 });
  });

  it("أمس صفر لا نسبة له، وبلا تغيّر لا شيء", () => {
    expect(deltaFromYesterday(5, 0)).toBeNull();
    expect(deltaFromYesterday(0, 0)).toBeNull();
    expect(deltaFromYesterday(4, 4)).toBeNull();
  });

  it("فرق يُقرَّب إلى صفر بالمئة لا يُعرض", () => {
    expect(deltaFromYesterday(1001, 1000)).toBeNull();
  });
});

describe("رقم اليوم من السلسلة", () => {
  const series: DailyOrders[] = [1, 2, 3, 4, 5, 6, 7, 8, 4, 6].map((created, index) => ({
    day: `2026-11-${String(index + 10)}`,
    created,
    paid: 0,
    revenueMinor: created * 100,
  }));

  it("اليوم آخر السلسلة، وأمس ما قبله، والخط آخر سبعة أيام", () => {
    const kpi = kpiOf(series, (day) => day.created, 7);
    expect(kpi).toEqual({
      today: 6,
      yesterday: 4,
      delta: { direction: "up", percent: 50 },
      trend: [4, 5, 6, 7, 8, 4, 6],
    });
    expect(kpiOf(series, (day) => day.revenueMinor, 7).today).toBe(600);
  });

  it("سلسلة فارغة أصفار", () => {
    expect(kpiOf([], (day) => day.created, 7)).toEqual({
      today: 0,
      yesterday: 0,
      delta: null,
      trend: [],
    });
  });
});

describe("الوقت النسبي", () => {
  const now = new Date("2026-11-26T12:00:00Z");
  const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000);

  it.each([
    [0, "الآن"],
    [59, "الآن"],
    [60, "قبل دقيقة واحدة"],
    [12 * 60, "قبل 12 دقيقة"],
    [3600, "قبل ساعة واحدة"],
    [3 * 3600, "قبل 3 ساعات"],
    [24 * 3600, "أمس"],
    [3 * 24 * 3600, "قبل 3 أيام"],
  ])("قبل %i ثانية ← %s", (seconds, expected) => {
    expect(relativeTime(ago(seconds), now)).toBe(expected);
  });

  it("بعد أسبوع يرجع null ليُعرض التاريخ، والمستقبل كالآن، والأرقام لاتينية", () => {
    expect(relativeTime(ago(8 * 24 * 3600), now)).toBeNull();
    expect(relativeTime(ago(-120), now)).toBe("الآن");
    expect(relativeTime(ago(5 * 3600), now)).not.toMatch(/[٠-٩]/);
  });
});

describe("جملة النشاط", () => {
  const dictionary = getAdminDictionary();
  const OWNER = "018f4e2a-0000-7000-8000-000000000001";
  const SALES = "018f4e2a-0000-7000-8000-000000000002";
  const names = new Map([
    [OWNER, "خالد"],
    [SALES, "سارة"],
  ]);
  const row = (overrides: Partial<AuditRow>): AuditRow => ({
    id: "018f4e2a-0000-7000-8000-00000000000a",
    entityType: "staff_user",
    entityId: SALES,
    action: "role_changed",
    fromState: "sales",
    toState: "manager",
    actor: `staff:${OWNER}`,
    data: {},
    createdAt: new Date("2026-11-26T09:00:00Z"),
    ...overrides,
  });

  it("حدث موظف بقالبه: الفاعل والموضوع باسميهما", () => {
    expect(activityItem(row({}), names, dictionary).sentence).toBe("تغيير دور سارة بواسطة خالد");
    const login = row({ action: "login_succeeded", entityId: OWNER });
    expect(activityItem(login, names, dictionary).sentence).toBe("دخول خالد إلى اللوحة");
  });

  it("حدث بيع بالقالب العام وباسمه العربي، وبلا بيانات الصف", () => {
    const sale = row({
      entityType: "order",
      entityId: "018f4e2a-aaaa-7000-8000-000000000009",
      action: "payment_verified",
      actor: "provider",
      data: { ip: "10.0.0.1" },
    });
    const item = activityItem(sale, names, dictionary);
    expect(item.sentence).toBe("سُجّل الدفع: طلب 018f4e2a (مزوّد الدفع)");
    const unknown = activityItem({ ...sale, action: "no_such_event" }, names, dictionary);
    expect(unknown.sentence).toBe("no_such_event: طلب 018f4e2a (مزوّد الدفع)");
    expect(item.sentence).not.toContain("10.0.0.1");
    expect(item.at).toEqual(sale.createdAt);
  });
});
