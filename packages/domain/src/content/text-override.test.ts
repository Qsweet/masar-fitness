import { describe, expect, it } from "vitest";
import { testRegistry } from "./test-registry";
import { validateTextOverride } from "./text-override";

const registry = testRegistry();
function entry(path: string) {
  const found = registry.editable.get(path);
  if (found === undefined) {
    throw new Error(path);
  }
  return found;
}

function reason(path: string, value: string, locale: "ar" | "en" = "ar") {
  const result = validateTextOverride(entry(path), value, locale);
  return result.ok ? result.value : result.error;
}

describe("validateTextOverride", () => {
  it("يُنظَّف ويُشذَّب، والفارغ مرفوض (العودة إلى الافتراضي زر مستقل)", () => {
    expect(reason("hero.title", "  أقوى\u0000 نسخة‏  ")).toEqual({
      kind: "override",
      value: "أقوى نسخة",
    });
    expect(reason("hero.title", " ‎ ")).toEqual({ reason: "content.empty" });
  });

  it("العناصر النائبة: الناقص والزائد باسمه، بلغة الافتراضي نفسها", () => {
    expect(reason("goals.line", "صالة كبيرة.")).toEqual({
      reason: "content.placeholder_missing",
      detail: "{count}",
    });
    expect(reason("goals.line", "أكثر من {count} جهازًا بـ{amount}.")).toEqual({
      reason: "content.placeholder_unknown",
      detail: "{amount}",
    });
    expect(reason("goals.line", "More than {count} machines.", "en")).toEqual({
      kind: "override",
      value: "More than {count} machines.",
    });
    expect(reason("hero.title", "أقوى {count}")).toEqual({
      reason: "content.placeholder_unknown",
      detail: "{count}",
    });
  });

  it("القوس الشارد مرفوض فلا تنكسر fill", () => {
    expect(reason("goals.line", "أكثر من {count} جهازًا {")).toEqual({
      reason: "content.brace_stray",
    });
    expect(reason("goals.line", "أكثر من {count } و{count}")).toEqual({
      reason: "content.brace_stray",
    });
  });

  it("سطر واحد لكل الأنواع", () => {
    expect(reason("hero.title", "سطر\nثانٍ")).toEqual({ reason: "content.multiline" });
    expect(reason("about.paragraphs.0", "فقرة\n\nثانية")).toEqual({ reason: "content.multiline" });
  });

  it("كل حد بنوعه، والطول بنقاط الترميز", () => {
    expect(entry("hero.title").kind).toBe("label");
    expect(reason("hero.title", "أ".repeat(40))).toMatchObject({ kind: "override" });
    expect(reason("hero.title", "أ".repeat(41))).toEqual({
      reason: "content.too_long",
      detail: "40",
    });
    expect(reason("meta.homeTitle", "أ".repeat(71))).toEqual({
      reason: "content.too_long",
      detail: "70",
    });
    expect(reason("about.paragraphs.0", "أ".repeat(701))).toEqual({
      reason: "content.too_long",
      detail: "700",
    });
  });

  it("تدقيق النصوص باللغتين يرفض ويذكر القاعدة والمقتطف", () => {
    expect(reason("hero.title", "أقوى, نسخة")).toMatchObject({ reason: "content.copy_lint" });
    expect(reason("hero.title", "أقوى  نسخة")).toEqual({
      reason: "content.copy_lint",
      detail: "double-space|أقوى  نسخة",
    });
    expect(reason("hero.title", "The strongest , you", "en")).toMatchObject({
      reason: "content.copy_lint",
      detail: expect.stringContaining("space-before-punctuation") as string,
    });
    expect(reason("hero.title", "مسار٣")).toMatchObject({
      detail: expect.stringContaining("arabic-indic-digits") as string,
    });
  });

  it("المساوي للافتراضي يُحفظ عودةً لا تجاوزًا", () => {
    expect(reason("hero.title", " أقوى نسخة منك ")).toEqual({ kind: "default" });
  });
});
