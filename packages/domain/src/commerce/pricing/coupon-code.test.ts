import { describe, expect, it } from "vitest";
import { parseCouponCode } from "./coupon-code";

function parsed(input: string): string | null {
  const result = parseCouponCode(input);
  if (!result.ok) {
    throw new Error(`رُفض الرمز: ${input}`);
  }
  return result.value;
}

describe("parseCouponCode", () => {
  it("الحقل الفارغ أو المسافات فقط يعني بلا كوبون", () => {
    expect(parsed("")).toBeNull();
    expect(parsed("   ")).toBeNull();
    expect(parsed("‏ ‎")).toBeNull();
  });

  it("ينظّف المسافات والحالة وعلامات الاتجاه", () => {
    expect(parsed("  save10 ")).toBe("SAVE10");
    expect(parsed("sa ve\t10")).toBe("SAVE10");
    expect(parsed("‏SAVE‎10⁦")).toBe("SAVE10");
  });

  it("يحوّل الأرقام العربية الهندية والفارسية", () => {
    expect(parsed("ramadan٢٠٢٦")).toBe("RAMADAN2026");
    expect(parsed("۱۲۳abc")).toBe("123ABC");
  });

  it("يقبل الطولين الحديين 3 و32", () => {
    expect(parsed("ab1")).toBe("AB1");
    expect(parsed("A".repeat(32))).toBe("A".repeat(32));
  });

  it("يرفض الصيغة غير الصالحة على الحقل coupon", () => {
    for (const bad of ["AB", "A".repeat(33), "SAVE-10", "خصم10", "SAVE_10", "ÉTÉ10"]) {
      const result = parseCouponCode(bad);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("validation");
        expect(result.error.reason).toBe("coupon.invalid_format");
        expect(result.error.field).toBe("coupon");
      }
    }
  });
});
