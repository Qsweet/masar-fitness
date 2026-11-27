import { describe, expect, it } from "vitest";
import { validateSlide } from "./validate";
import { CONTEXT, MOBILE_IMAGE, testImage, testInput } from "./test-fixtures";

const BLANK = { eyebrow: "", title: "", subtitle: "", cta: "" };
const fieldsOf = (result: ReturnType<typeof validateSlide>) =>
  result.ok ? [] : result.error.map((issue) => `${issue.field}:${issue.reason}`);

describe("validateSlide", () => {
  it("يقبل شريحة صحيحة وينظّف النص ويحفظ هدف النقر «الزر» بلا رابط", () => {
    const result = validateSlide(
      testInput({
        clickTarget: "slide",
        texts: { ar: { ...BLANK, title: "  ابدأ‏ اليوم " }, en: { ...BLANK } },
      }),
      CONTEXT,
    );
    expect(result).toMatchObject({
      ok: true,
      value: { clickTarget: "button", texts: { ar: { title: "ابدأ اليوم" } } },
    });
  });

  it("صورة الحاسوب إلزامية، والصغيرة مرفوضة للموضعين", () => {
    expect(fieldsOf(validateSlide(testInput({ desktop: null }), CONTEXT))).toContain(
      "desktop:slider.image_required",
    );
    const small = validateSlide(
      testInput({ desktop: testImage({ width: 1000 }), mobile: { ...MOBILE_IMAGE, width: 500 } }),
      CONTEXT,
    );
    expect(fieldsOf(small)).toEqual([
      "desktop:slider.image_too_small",
      "mobile:slider.image_too_small",
    ]);
  });

  it("النص البديل إلزامي باللغتين إلا للزخرفية، وللزخرفية يُحفظ فارغًا", () => {
    expect(fieldsOf(validateSlide(testInput({ alt: { ar: "", en: " " } }), CONTEXT))).toEqual([
      "alt.ar:slider.alt_required",
      "alt.en:slider.alt_required",
    ]);
    const decorative = validateSlide(
      testInput({ decorative: true, alt: { ar: "يُهمل", en: "ignored" } }),
      CONTEXT,
    );
    expect(decorative).toMatchObject({ ok: true, value: { alt: { ar: "", en: "" } } });
  });

  it("النصوص: سطر واحد، بلا أقواس، والحد، وتدقيق النصوص", () => {
    const result = validateSlide(
      testInput({
        texts: {
          ar: { ...BLANK, title: "سطر\nثانٍ", eyebrow: "{x}" },
          en: { ...BLANK, title: "a".repeat(71), subtitle: "Bad  spacing" },
        },
      }),
      CONTEXT,
    );
    expect(fieldsOf(result)).toEqual([
      "texts.ar.eyebrow:slider.brace",
      "texts.ar.title:slider.multiline",
      "texts.en.title:slider.too_long",
      "texts.en.subtitle:slider.copy_lint",
    ]);
  });

  it("بلا رابط لا زر، والنقر على الزر يشترط تسميته باللغتين", () => {
    const noLink = validateSlide(
      testInput({ texts: { ar: { ...BLANK, cta: "اشترك" }, en: { ...BLANK } } }),
      CONTEXT,
    );
    expect(fieldsOf(noLink)).toEqual(["texts.ar.cta:slider.cta_without_link"]);
    const button = validateSlide(
      testInput({
        link: { kind: "internal", internal: "/memberships", external: "", newTab: false },
        texts: { ar: { ...BLANK, cta: "الاشتراكات" }, en: { ...BLANK } },
      }),
      CONTEXT,
    );
    expect(fieldsOf(button)).toEqual(["texts.en.cta:slider.cta_required"]);
  });

  it("النقر على الشريحة يشترط اسمًا للرابط في كل لغة", () => {
    const nameless = validateSlide(
      testInput({
        decorative: true,
        clickTarget: "slide",
        texts: { ar: { ...BLANK }, en: { ...BLANK } },
        link: { kind: "external", internal: "", external: "https://example.com", newTab: true },
      }),
      CONTEXT,
    );
    expect(fieldsOf(nameless)).toEqual(["link:slider.link_name_missing"]);
    const named = validateSlide(
      testInput({
        clickTarget: "slide",
        texts: { ar: { ...BLANK }, en: { ...BLANK } },
        link: { kind: "external", internal: "", external: "https://example.com", newTab: true },
      }),
      CONTEXT,
    );
    expect(named).toMatchObject({ ok: true, value: { clickTarget: "slide" } });
  });

  it("الرابط والهدف والجدولة بحقولها", () => {
    const result = validateSlide(
      testInput({
        link: { kind: "external", internal: "", external: "javascript:alert(1)", newTab: false },
        clickTarget: "everything",
        startsAt: "2026-12-02T10:00",
        endsAt: "2026-12-01T10:00",
      }),
      CONTEXT,
    );
    expect(fieldsOf(result)).toEqual([
      "link:slider.link_https_only",
      "clickTarget:slider.click_target_unknown",
      "endsAt:slider.schedule_order",
    ]);
  });
});

describe("هدف النقر بلا رابط", () => {
  it("حقل الهدف الغائب (مخفي بلا رابط) يُحفظ «الزر»، ومع رابط إلزامي", () => {
    expect(validateSlide(testInput({ clickTarget: "" }), CONTEXT)).toMatchObject({
      ok: true,
      value: { clickTarget: "button" },
    });
    const linked = validateSlide(
      testInput({
        clickTarget: "",
        link: { kind: "external", internal: "", external: "https://example.com", newTab: false },
      }),
      CONTEXT,
    );
    expect(fieldsOf(linked)).toEqual(["clickTarget:slider.click_target_unknown"]);
  });
});
