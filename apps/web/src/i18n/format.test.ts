import { money } from "@masar/domain";
import { describe, expect, it } from "vitest";
import { formatMonths, moneyParts, monthsParts, roundedMoneyParts } from "./format";

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

describe("roundedMoneyParts", () => {
  it("يقرّب لأقرب ريال", () => {
    expect(roundedMoneyParts(money(8571), "ar")).toEqual({ amount: "86", unit: "ر.س" });
    expect(roundedMoneyParts(money(33333), "en")).toEqual({ amount: "333", unit: "SAR" });
    expect(roundedMoneyParts(money(20000), "ar").amount).toBe("200");
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
