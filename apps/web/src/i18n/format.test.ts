import { money } from "@masar/domain";
import { describe, expect, it } from "vitest";
import { countedMonthsParts, formatList, formatMonths, moneyParts, monthsParts } from "./format";

describe("moneyParts", () => {
  it("ريالات كاملة بلا كسور وبفاصلة الآلاف", () => {
    expect(moneyParts(money(280000), "ar")).toEqual({ amount: "2,800", unit: "ر.س" });
    expect(moneyParts(money(280000), "en")).toEqual({ amount: "2,800", unit: "SAR" });
    expect(moneyParts(money(35000), "ar").amount).toBe("350");
  });

  it("الهللات تظهر بخانتين حين توجد", () => {
    expect(moneyParts(money(25758), "ar").amount).toBe("257.58");
    expect(moneyParts(money(25750), "ar").amount).toBe("257.50");
    expect(moneyParts(money(5), "ar").amount).toBe("0.05");
  });

  it("الأرقام لاتينية في العربية", () => {
    expect(moneyParts(money(123456700), "ar").amount).toBe("1,234,567");
  });

  it("الصفر والسالب", () => {
    expect(moneyParts(money(0), "ar").amount).toBe("0");
    expect(moneyParts(money(-15000), "en").amount).toBe("-150");
  });
});

describe("الأشهر", () => {
  it.each([
    [1, "شهر"],
    [2, "شهران"],
    [3, "3 أشهر"],
    [6, "6 أشهر"],
    [10, "10 أشهر"],
    [11, "11 شهرًا"],
    [12, "12 شهرًا"],
    [14, "14 شهرًا"],
    [24, "24 شهرًا"],
  ])("العربية: %i ⇒ %s", (months, expected) => {
    expect(formatMonths(months, "ar")).toBe(expected);
  });

  it.each([
    [1, "1 month"],
    [2, "2 months"],
    [12, "12 months"],
  ])("الإنجليزية: %i ⇒ %s", (months, expected) => {
    expect(formatMonths(months, "en")).toBe(expected);
  });

  it("المفرد والمثنى بلا رقم في العربية", () => {
    expect(monthsParts(1, "ar")).toEqual({ count: undefined, unit: "شهر" });
    expect(monthsParts(2, "ar")).toEqual({ count: undefined, unit: "شهران" });
    expect(monthsParts(12, "ar")).toEqual({ count: "12", unit: "شهرًا" });
  });
});

describe("countedMonthsParts", () => {
  it("الرقم ظاهر دائمًا، والمفرد بعد 1 و2 في العربية", () => {
    expect(countedMonthsParts(1, "ar")).toEqual({ count: "1", unit: "شهر" });
    expect(countedMonthsParts(2, "ar")).toEqual({ count: "2", unit: "شهر" });
    expect(countedMonthsParts(3, "ar")).toEqual({ count: "3", unit: "أشهر" });
    expect(countedMonthsParts(12, "ar")).toEqual({ count: "12", unit: "شهرًا" });
  });

  it("الإنجليزية مفرد وجمع", () => {
    expect(countedMonthsParts(1, "en")).toEqual({ count: "1", unit: "month" });
    expect(countedMonthsParts(2, "en")).toEqual({ count: "2", unit: "months" });
  });
});

describe("formatList", () => {
  it("عطف بالواو في العربية وبالفاصلة و and في الإنجليزية", () => {
    expect(formatList(["المسبح", "الجاكوزي", "البخار"], "ar")).toBe("المسبح والجاكوزي والبخار");
    expect(formatList(["Pool", "Jacuzzi", "Steam room"], "en")).toBe(
      "Pool, Jacuzzi, and Steam room",
    );
    expect(formatList(["Pool"], "en")).toBe("Pool");
  });
});
