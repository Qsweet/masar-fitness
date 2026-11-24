import { describe, expect, it } from "vitest";
import { parseSaudiMobile } from "./saudi-mobile";

const E164 = "+966512345678";

describe("parseSaudiMobile", () => {
  it.each([
    ["0512345678"],
    ["512345678"],
    ["+966512345678"],
    ["966512345678"],
    ["00966512345678"],
    ["+966 51 234 5678"],
    ["051-234-5678"],
    ["  0512345678  "],
    ["٠٥١٢٣٤٥٦٧٨"],
    ["۰۵۱۲۳۴۵۶۷۸"],
    ["+٩٦٦٥١٢٣٤٥٦٧٨"],
    ["+966 0512345678"],
    ["05.1234.5678"],
    ["\u202A+966 51 234 5678\u202C"], // منسوخ من واتساب بعلامات اتجاه غير مرئية
    ["\u200F0512345678\u200E"],
    ["(051) 234-5678"],
  ])("يقبل %s ويوحّده إلى E.164", (input) => {
    const result = parseSaudiMobile(input);
    expect(result).toEqual({ ok: true, value: E164 });
  });

  it.each([
    ["", "mobile.invalid_characters"],
    ["abc", "mobile.invalid_characters"],
    ["0512345678x", "mobile.invalid_characters"],
    ["051234567", "mobile.not_saudi_mobile"], // ناقص رقمًا
    ["05123456789", "mobile.not_saudi_mobile"], // زائد رقمًا
    ["0112345678", "mobile.not_saudi_mobile"], // هاتف ثابت
    ["+971512345678", "mobile.not_saudi_mobile"], // دولة أخرى
    ["0612345678", "mobile.not_saudi_mobile"],
    ["+0512345678", "mobile.not_saudi_mobile"], // + بلا رمز الدولة
    ["+512345678", "mobile.not_saudi_mobile"],
    ["+00966512345678", "mobile.not_saudi_mobile"],
    ["()", "mobile.not_saudi_mobile"],
    ["-", "mobile.not_saudi_mobile"],
    ["٠٥١٢٣٤٥٦٧٨#", "mobile.invalid_characters"],
    ["0512345678;drop", "mobile.invalid_characters"],
  ])("يرفض %s", (input, reason) => {
    const result = parseSaudiMobile(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("validation");
      expect(result.error.reason).toBe(reason);
      expect(result.error.field).toBe("mobile");
    }
  });
});
