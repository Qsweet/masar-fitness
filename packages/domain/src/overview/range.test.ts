import { describe, expect, it } from "vitest";
import { clubToday, MAX_RANGE_DAYS, parseRange, rangeDays } from "./range";

const RIYADH = "Asia/Riyadh";
/** 27 نوفمبر 01:30 في الرياض = 26 نوفمبر 22:30 UTC: اليوم بتقويم النادي غير يوم UTC. */
const NOW = new Date("2026-11-26T22:30:00Z");

describe("parseRange: الفترة بتقويم النادي", () => {
  it("اليوم بتقويم الرياض لا بتوقيت UTC", () => {
    expect(clubToday(NOW, RIYADH)).toBe("2026-11-27");
    const { range } = parseRange({ range: "today" }, NOW, RIYADH);
    expect(range).toMatchObject({ preset: "today", from: "2026-11-27", to: "2026-11-27", days: 1 });
    // منتصف ليل الرياض 21:00 UTC من اليوم السابق، والنهاية الآن
    expect(range.start.toISOString()).toBe("2026-11-26T21:00:00.000Z");
    expect(range.end).toEqual(NOW);
  });

  it("الفترة السابقة بالطول نفسه، ومقصوصة إلى الزمن المنقضي نفسه", () => {
    const { range } = parseRange({ range: "today" }, NOW, RIYADH);
    expect(range.previous).toMatchObject({ from: "2026-11-26", to: "2026-11-26" });
    expect(range.previous.start.toISOString()).toBe("2026-11-25T21:00:00.000Z");
    // ساعة ونصف من أمس مقابل ساعة ونصف من اليوم
    expect(range.previous.end.toISOString()).toBe("2026-11-25T22:30:00.000Z");
  });

  it("7 و30 و90 يومًا حتى اليوم، والافتراضي 30", () => {
    expect(parseRange({ range: "7d" }, NOW, RIYADH).range).toMatchObject({
      from: "2026-11-21",
      to: "2026-11-27",
      days: 7,
    });
    expect(parseRange({}, NOW, RIYADH)).toMatchObject({
      range: { preset: "30d", from: "2026-10-29", days: 30 },
      issue: null,
    });
    const ninety = parseRange({ range: "90d" }, NOW, RIYADH).range;
    expect(ninety.previous.to).toBe("2026-08-29");
    expect(ninety.days).toBe(90);
  });

  it("مدى مخصص بيومين كاملين في الماضي: السابقة كاملة أيضًا", () => {
    const { range, issue } = parseRange({ from: "2026-11-01", to: "2026-11-10" }, NOW, RIYADH);
    expect(issue).toBeNull();
    expect(range).toMatchObject({ preset: "custom", days: 10 });
    expect(range.end.toISOString()).toBe("2026-11-10T21:00:00.000Z");
    expect(range.previous).toMatchObject({ from: "2026-10-22", to: "2026-10-31" });
    expect(range.previous.end.toISOString()).toBe("2026-10-31T21:00:00.000Z");
  });

  it("المرفوض يعرض الافتراضي ويقول لماذا", () => {
    const issue = (input: Parameters<typeof parseRange>[0]) => parseRange(input, NOW, RIYADH);
    expect(issue({ from: "2026-11-10", to: "2026-11-01" }).issue).toBe("reversed");
    expect(issue({ from: "2026-02-30", to: "2026-03-01" }).issue).toBe("invalid");
    expect(issue({ from: "2026-11-01" }).issue).toBe("invalid");
    expect(issue({ from: "2026-11-20", to: "2026-11-28" }).issue).toBe("future");
    expect(issue({ range: "1y" })).toMatchObject({ issue: "invalid", range: { preset: "30d" } });
  });

  it("التواريخ القديمة جدًّا (رابط معدَّل) مرفوضة قبل أن تصل القاعدة، ومعها السابقة", () => {
    const early = (from: string, to: string) => parseRange({ from, to }, NOW, RIYADH);
    expect(early("0000-01-01", "0000-01-01").issue).toBe("too_early");
    expect(early("0001-01-01", "0001-01-05").issue).toBe("too_early");
    expect(early("2019-12-31", "2020-01-02").issue).toBe("too_early");
    // السابقة تبدأ قبل الحد: 2020-01-01..2020-01-02 سابقتها 2019-12-30
    expect(early("2020-01-01", "2020-01-02").issue).toBe("too_early");
    expect(early("2020-01-03", "2020-01-04").issue).toBeNull();
    expect(early("0001-01-01", "0001-01-05").range.preset).toBe("30d");
  });

  it("الحد الأقصى 366 يومًا بالضبط", () => {
    const ok = parseRange({ from: "2025-11-27", to: "2026-11-27" }, NOW, RIYADH);
    expect(ok.range.days).toBe(MAX_RANGE_DAYS);
    expect(ok.issue).toBeNull();
    const long = parseRange({ from: "2025-11-26", to: "2026-11-27" }, NOW, RIYADH);
    expect(long.issue).toBe("too_long");
  });

  it("أيام الفترة بالترتيب، الأقدم أولًا", () => {
    expect(rangeDays({ from: "2026-02-27", to: "2026-03-02" })).toEqual([
      "2026-02-27",
      "2026-02-28",
      "2026-03-01",
      "2026-03-02",
    ]);
  });
});
