import { describe, expect, it } from "vitest";
import { fill } from "./fill";

describe("fill", () => {
  it("يستبدل كل ظهور لكل مفتاح", () => {
    expect(fill("{a} و{b} و{a}", { a: "1", b: "2" })).toBe("1 و2 و1");
  });

  it("يترك المفتاح غير الموجود كما هو", () => {
    expect(fill("{a} {missing}", { a: "x" })).toBe("x {missing}");
  });

  it("لا يعيد تفسير قيمة تشبه مفتاحًا", () => {
    expect(fill("{a}{b}", { a: "{b}", b: "z" })).toBe("{b}z");
  });
});
