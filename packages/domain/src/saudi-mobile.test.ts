import { describe, expect, it } from "vitest";
import { lastMobileDigits, maskSaudiMobile, parseSaudiMobile } from "./saudi-mobile";

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

describe("maskSaudiMobile", () => {
  it("يُبقي بادئة الدولة وآخر الأرقام المطلوبة فقط", () => {
    expect(maskSaudiMobile("+966512345678", 2)).toBe("+966•••••••78");
    expect(maskSaudiMobile("+966512345678", 4)).toBe("+966•••••5678");
    expect(maskSaudiMobile("+966512345678", 0)).toBe("+966•••••••••");
  });

  it("طول الناتج ثابت مهما كان عدد الأرقام الظاهرة", () => {
    for (const visible of [0, 1, 2, 4, 8]) {
      expect(Array.from(maskSaudiMobile("+966512345678", visible))).toHaveLength(13);
    }
  });

  it("قيمة ليست جوالًا سعوديًا مخزَّنًا تُقنَّع كلها", () => {
    for (const value of ["", "0512345678", "+14155550123", "+96651234567", "+9665123456789"]) {
      expect(maskSaudiMobile(value, 4)).toBe("•••••••••");
    }
  });

  it("يرفض عددًا لا يُبقي شيئًا مقنَّعًا", () => {
    for (const visible of [-1, 9, 12, 1.5, Number.NaN]) {
      expect(() => maskSaudiMobile("+966512345678", visible)).toThrow("mobile.mask_visible_digits");
    }
  });
});

describe("lastMobileDigits", () => {
  it("آخر الأرقام للتعرّف", () => {
    expect(lastMobileDigits("+966512345678", 4)).toBe("5678");
    expect(lastMobileDigits("+966512345678", 0)).toBe("");
    expect(() => lastMobileDigits("+966512345678", 9)).toThrow("mobile.mask_visible_digits");
  });
});
