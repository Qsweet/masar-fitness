import { describe, expect, it } from "vitest";
import { MAX_AMOUNT_MINOR } from "./commerce/pricing/limits";
import { parseSarAmount } from "./sar-amount";

function reasonOf(input: string): string {
  const parsed = parseSarAmount(input);
  return parsed.ok ? `ok:${String(parsed.value)}` : parsed.error.reason;
}

describe("parseSarAmount: ما يُقبل", () => {
  it.each([
    ["0", 0],
    ["1", 100],
    ["1499", 149_900],
    ["1499.5", 149_950],
    ["1499.50", 149_950],
    ["1499.05", 149_905],
    ["0.01", 1],
    ["0.10", 10],
    ["007", 700],
    ["1,499", 149_900],
    ["1,499.00", 149_900],
    ["12,345,678.90", 1_234_567_890],
    ["  1499  ", 149_900],
  ])("%s ← %d هللة", (input, expected) => {
    expect(parseSarAmount(input)).toEqual({ ok: true, value: expected });
  });

  it("أرقام عربية وفارسية وفواصلها", () => {
    expect(reasonOf("١٤٩٩")).toBe("ok:149900");
    expect(reasonOf("١٬٤٩٩٫٥٠")).toBe("ok:149950");
    expect(reasonOf("۱۴۹۹.۵")).toBe("ok:149950");
    expect(reasonOf("١٤٩٩.٥٠")).toBe("ok:149950");
  });

  it("علامات الاتجاه غير المرئية المنسوخة مع الرقم تُهمل", () => {
    expect(reasonOf("‏1499‎")).toBe("ok:149900");
    expect(reasonOf("‪1,499.50‬")).toBe("ok:149950");
  });

  it("الحد الأعلى نفسه مقبول، وما فوقه بهللة مرفوض", () => {
    expect(reasonOf("21474836.47")).toBe(`ok:${String(MAX_AMOUNT_MINOR)}`);
    expect(reasonOf("21474836.48")).toBe("amount.too_large");
  });

  it("الناتج عدد صحيح دائمًا ولو لمبالغ تخطئ فيها الكسور العشرية", () => {
    // 0.1 + 0.2 و 1.15 * 100 تخطئان بالفاصلة العائمة
    expect(reasonOf("0.30")).toBe("ok:30");
    expect(reasonOf("1.15")).toBe("ok:115");
    expect(reasonOf("4.35")).toBe("ok:435");
    expect(reasonOf("1001.10")).toBe("ok:100110");
    for (let halalas = 0; halalas < 100; halalas += 1) {
      const text = `19.${String(halalas).padStart(2, "0")}`;
      expect(reasonOf(text)).toBe(`ok:${String(1900 + halalas)}`);
    }
  });
});

describe("parseSarAmount: ما يُرفض", () => {
  it.each(["1.499", "0.001", "1499.500", "1,499.123", "١٫٢٣٤"])(
    "أكثر من خانتين عشريتين: %s",
    (input) => {
      expect(reasonOf(input)).toBe("amount.too_many_decimals");
    },
  );

  it.each(["-1", "-0.01", "−5", "-1,499", "-٥"])("سالب: %s", (input) => {
    expect(reasonOf(input)).toBe("amount.negative");
  });

  it.each([
    "",
    " ",
    ".",
    ".5",
    "5.",
    "1,5",
    "1,49",
    "14,99",
    "1,4999",
    ",499",
    "1,,499",
    "1.2.3",
    "1 499",
    "1499 ر.س",
    "SAR 1499",
    "1499$",
    "+1499",
    "1e3",
    "0x10",
    "Infinity",
    "NaN",
    "١٤٩٩ ريال",
    "1.-5",
    "1.5-",
    "1499.5,0",
  ])("صيغة غير مقبولة: «%s»", (input) => {
    expect(reasonOf(input)).toBe("amount.invalid_format");
  });

  it.each(["21474836.48", "99999999", "999,999,999,999", "9".repeat(30)])(
    "أكبر من حد العمود: %s",
    (input) => {
      expect(reasonOf(input)).toBe("amount.too_large");
    },
  );

  it("إدخال ضخم يُرفض قبل أي تحليل", () => {
    expect(reasonOf("9".repeat(33))).toBe("amount.invalid_format");
    expect(reasonOf("1".repeat(10_000))).toBe("amount.invalid_format");
  });

  it("الخطأ يحمل اسم الحقل، وصنفه validation", () => {
    const parsed = parseSarAmount("abc");
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error.code).toBe("validation");
      expect(parsed.error.field).toBe("amount");
    }
  });
});
