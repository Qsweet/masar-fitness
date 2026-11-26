import { describe, expect, it } from "vitest";
import { formatZonedDateTime, parseZonedDateTime } from "./zoned-time";

describe("الوقت المحلي بمنطقة النادي", () => {
  it("الرياض (UTC+3 بلا توقيت صيفي): ذهابًا وإيابًا", () => {
    const parsed = parseZonedDateTime("2026-06-01T00:00", "Asia/Riyadh");
    expect(parsed).toEqual({ ok: true, value: new Date("2026-05-31T21:00:00Z") });
    expect(formatZonedDateTime(new Date("2026-05-31T21:00:00Z"), "Asia/Riyadh")).toBe(
      "2026-06-01T00:00",
    );
    expect(formatZonedDateTime(new Date("2026-12-31T20:59:59.999Z"), "Asia/Riyadh")).toBe(
      "2026-12-31T23:59",
    );
  });

  it("منطقة بتوقيت صيفي: قبل التحويل وبعده", () => {
    expect(parseZonedDateTime("2026-01-15T12:00", "Europe/London")).toEqual({
      ok: true,
      value: new Date("2026-01-15T12:00:00Z"),
    });
    expect(parseZonedDateTime("2026-07-15T12:00", "Europe/London")).toEqual({
      ok: true,
      value: new Date("2026-07-15T11:00:00Z"),
    });
  });

  it("وقت لا يوجد على ساعة المنطقة (فجوة التحويل) مرفوض", () => {
    const gap = parseZonedDateTime("2026-03-29T01:30", "Europe/London");
    expect(!gap.ok && gap.error.reason).toBe("date_time.invalid");
  });

  it.each(["", "2026-06-01", "2026-06-01 10:00", "2026-6-1T10:00", "abc"])(
    "صيغة «%s» مرفوضة",
    (input) => {
      const parsed = parseZonedDateTime(input, "Asia/Riyadh");
      expect(!parsed.ok && parsed.error.reason).toBe("date_time.invalid_format");
    },
  );

  it.each(["2026-02-30T10:00", "2026-13-01T10:00", "2026-06-01T24:00", "2026-06-01T10:60"])(
    "تاريخ أو وقت غير موجود «%s» مرفوض",
    (input) => {
      expect(parseZonedDateTime(input, "Asia/Riyadh").ok).toBe(false);
    },
  );

  it("منطقة زمنية مجهولة خلل لا خطأ إدخال", () => {
    expect(() => formatZonedDateTime(new Date(0), "Mars/Olympus")).toThrow(
      "date.invalid_time_zone",
    );
  });
});
