import { describe, expect, it } from "vitest";
import { parseBuyer, parseBuyerName } from "./buyer";

function nameReason(input: string): string | null {
  const result = parseBuyerName(input);
  return result.ok ? null : result.error.reason;
}

describe("parseBuyerName", () => {
  it("يوحّد المسافات ويقصّ الطرفين", () => {
    expect(parseBuyerName("  محمد \t\n  أحمد  ")).toEqual({ ok: true, value: "محمد أحمد" });
  });

  it("ينظّف محارف الاتجاه غير المرئية", () => {
    expect(parseBuyerName("‫سارة‏ ‬العلي‎")).toEqual({
      ok: true,
      value: "سارة العلي",
    });
  });

  it("الطول بالمحارف: حرفان مقبولان و120 مقبولة", () => {
    expect(parseBuyerName("Al").ok).toBe(true);
    expect(parseBuyerName("ع".repeat(120)).ok).toBe(true);
  });

  it.each([
    ["", "buyer.name_too_short"],
    ["   ", "buyer.name_too_short"],
    ["م", "buyer.name_too_short"],
    ["‏م‎", "buyer.name_too_short"],
    ["ع".repeat(121), "buyer.name_too_long"],
    ["12345", "buyer.name_invalid"],
    ["--", "buyer.name_invalid"],
    ["Ali\u0000", "buyer.name_invalid"],
  ])("يرفض %j بـ%s", (input, reason) => {
    expect(nameReason(input)).toBe(reason);
  });

  it("الخطأ على الحقل name من صنف validation", () => {
    const result = parseBuyerName("");
    expect(result.ok ? null : [result.error.code, result.error.field]).toEqual([
      "validation",
      "name",
    ]);
  });
});

describe("parseBuyer", () => {
  it("يرجع المشتري بجوال E.164", () => {
    expect(parseBuyer({ name: " نورة ", mobile: "0512345678" })).toEqual({
      ok: true,
      value: { name: "نورة", mobile: "+966512345678" },
    });
  });

  it("يرجع كل أخطاء الحقول معًا", () => {
    const result = parseBuyer({ name: "x", mobile: "0112345678" });
    expect(result.ok ? null : result.error.map((e) => [e.field, e.reason])).toEqual([
      ["name", "buyer.name_too_short"],
      ["mobile", "mobile.not_saudi_mobile"],
    ]);
  });

  it("خطأ حقل واحد يرجع وحده", () => {
    const result = parseBuyer({ name: "نورة", mobile: "abc" });
    expect(result.ok ? null : result.error.map((e) => e.field)).toEqual(["mobile"]);
  });
});
