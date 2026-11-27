import { describe, expect, it } from "vitest";
import { keyTarget } from "./carousel";

describe("مفاتيح الشريط (APG)", () => {
  it("في RTL السهم الأيسر «التالي» والأيمن «السابق»، وبالعكس في LTR", () => {
    expect(keyTarget("ArrowLeft", true, 1, 4)).toBe(2);
    expect(keyTarget("ArrowRight", true, 1, 4)).toBe(0);
    expect(keyTarget("ArrowRight", false, 1, 4)).toBe(2);
    expect(keyTarget("ArrowLeft", false, 1, 4)).toBe(0);
  });

  it("Home وEnd إلى الطرفين، وغيرها لا شيء", () => {
    expect(keyTarget("Home", true, 2, 4)).toBe(0);
    expect(keyTarget("End", false, 0, 4)).toBe(3);
    expect(keyTarget("Enter", false, 0, 4)).toBeNull();
    expect(keyTarget("constructor", false, 0, 4)).toBeNull();
  });
});
