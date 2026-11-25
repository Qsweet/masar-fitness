import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonthsClamped,
  comparePlainDates,
  formatPlainDate,
  parsePlainDate,
  plainDate,
  plainDateInZone,
} from "./plain-date";

const RIYADH = "Asia/Riyadh";

describe("plainDateInZone", () => {
  it("20:59Z ما زال اليوم نفسه بتوقيت الرياض", () => {
    const date = plainDateInZone(new Date("2026-11-25T20:59:59.999Z"), RIYADH);
    expect(formatPlainDate(date)).toBe("2026-11-25");
  });

  it("21:00Z منتصف الليل بالرياض، فهو اليوم التالي", () => {
    const date = plainDateInZone(new Date("2026-11-25T21:00:00.000Z"), RIYADH);
    expect(formatPlainDate(date)).toBe("2026-11-26");
  });

  it("21:00Z آخر السنة يقع في السنة التالية", () => {
    const date = plainDateInZone(new Date("2026-12-31T21:00:00.000Z"), RIYADH);
    expect(date).toEqual({ year: 2027, month: 1, day: 1 });
  });

  it("منطقة غير معروفة ترمي invariant", () => {
    expect(() => plainDateInZone(new Date(), "Mars/Base")).toThrow("date.invalid_time_zone");
  });

  it("لحظة غير صالحة ترمي invariant", () => {
    expect(() => plainDateInZone(new Date(Number.NaN), RIYADH)).toThrow("date.invalid_instant");
  });
});

describe("addMonthsClamped", () => {
  it.each([
    ["2027-01-31", 1, "2027-02-28"],
    ["2028-01-31", 1, "2028-02-29"],
    ["2028-02-29", 12, "2029-02-28"],
    ["2026-11-30", 14, "2028-01-30"],
    ["2026-11-30", 3, "2027-02-28"],
    ["2026-03-31", 1, "2026-04-30"],
    ["2026-12-15", 1, "2027-01-15"],
    ["2026-05-10", 0, "2026-05-10"],
    ["2027-03-31", -1, "2027-02-28"],
    ["2027-01-15", -13, "2025-12-15"],
  ])("%s + %i شهر = %s (مطابق لـPostgreSQL)", (start, months, expected) => {
    const parsed = parsePlainDate(start);
    if (!parsed.ok) {
      throw parsed.error;
    }
    expect(formatPlainDate(addMonthsClamped(parsed.value, months))).toBe(expected);
  });

  it("يرمي invariant لعدد أشهر غير صحيح", () => {
    expect(() => addMonthsClamped(plainDate(2027, 1, 1), 1.5)).toThrow("date.invalid_months");
  });
});

describe("addDays", () => {
  it("يعبر آخر الشهر والسنة والكبيسة", () => {
    expect(formatPlainDate(addDays(plainDate(2026, 12, 31), 1))).toBe("2027-01-01");
    expect(formatPlainDate(addDays(plainDate(2028, 2, 28), 1))).toBe("2028-02-29");
    expect(formatPlainDate(addDays(plainDate(2027, 3, 1), -1))).toBe("2027-02-28");
    expect(formatPlainDate(addDays(plainDate(2027, 1, 1), 365))).toBe("2028-01-01");
  });

  it("يرمي invariant لعدد أيام غير صحيح", () => {
    expect(() => addDays(plainDate(2027, 1, 1), Number.NaN)).toThrow("date.invalid_days");
  });
});

describe("comparePlainDates", () => {
  it("يرتّب بالسنة ثم الشهر ثم اليوم", () => {
    expect(comparePlainDates(plainDate(2027, 1, 1), plainDate(2026, 12, 31))).toBeGreaterThan(0);
    expect(comparePlainDates(plainDate(2027, 1, 31), plainDate(2027, 2, 1))).toBeLessThan(0);
    expect(comparePlainDates(plainDate(2027, 2, 1), plainDate(2027, 2, 1))).toBe(0);
  });
});

describe("formatPlainDate و parsePlainDate", () => {
  it("ذهاب وإياب بصيغة YYYY-MM-DD", () => {
    expect(parsePlainDate("2027-02-05")).toEqual({ ok: true, value: plainDate(2027, 2, 5) });
    expect(formatPlainDate(plainDate(987, 2, 5))).toBe("0987-02-05");
  });

  it.each(["2027-2-5", "2027/02/05", "", "2027-02-05T00:00", " 2027-02-05"])(
    "صيغة مرفوضة: %s",
    (input) => {
      const result = parsePlainDate(input);
      expect(result.ok ? null : result.error.reason).toBe("date.invalid_format");
    },
  );

  it.each(["2027-02-29", "2027-13-01", "2027-00-10", "2027-04-31", "0000-01-01"])(
    "تاريخ غير موجود: %s",
    (input) => {
      const result = parsePlainDate(input);
      expect(result.ok ? null : result.error.reason).toBe("date.invalid");
    },
  );

  it("plainDate يرمي invariant لتاريخ غير موجود", () => {
    expect(() => plainDate(2027, 2, 29)).toThrow("date.invalid");
  });
});
