import { describe, expect, it } from "vitest";
import { formatClock } from "./clock";

const AR = { am: "ص", pm: "م" };
const EN = { am: "AM", pm: "PM" };

describe("formatClock", () => {
  it("يكتب الأوقات كما يعرضها موقع النادي", () => {
    expect(formatClock("06:00", AR)).toBe("6:00 ص");
    expect(formatClock("02:00", AR)).toBe("2:00 ص");
    expect(formatClock("13:00", AR)).toBe("1:00 م");
    expect(formatClock("23:30", AR)).toBe("11:30 م");
  });

  it("منتصف الليل 12:00 ص والظهر 12:00 م", () => {
    expect(formatClock("00:00", AR)).toBe("12:00 ص");
    expect(formatClock("12:00", EN)).toBe("12:00 PM");
  });

  it("يرفض وقتًا غير صالح", () => {
    expect(() => formatClock("25:00", EN)).toThrow(RangeError);
    expect(() => formatClock("bad", EN)).toThrow(RangeError);
  });
});
