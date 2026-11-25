import { describe, expect, it } from "vitest";
import { ARTICLE } from ".";

/** حقائق النادي والإسناد: المقال لا يدّعي عن النادي ما لم يؤكده المالك، ولا ينسب إلى مرجع ما ليس فيه. */
describe("مقال التمرين في رمضان: ادعاءات النادي والإسناد", () => {
  const ar = JSON.stringify(ARTICLE.translations.ar);
  const en = JSON.stringify(ARTICLE.translations.en);

  it("لا تكييف منسوب إلى المكان: الفكرة من المرجع مكان داخلي جيد التهوية", () => {
    expect(ar).not.toMatch(/مكي[ّ]?ف|تكييف/u);
    expect(en).not.toMatch(/air[- ]?condition/iu);
    expect(ar).toContain("مكان داخلي جيد التهوية بعد الإفطار");
    expect(en).toContain("well-ventilated indoor space after iftar");
  });

  it("«لا تطارد أرقامك القياسية صائمًا» نصيحة غير منسوبة إلى أي مرجع", () => {
    const steps = (locale: "ar" | "en") =>
      ARTICLE.translations[locale]?.sections
        .find((section) => section.id === "muscle")
        ?.blocks.flatMap((block) => (block.type === "steps" ? block.items : [])) ?? [];
    const personalBest = [
      ...steps("ar").filter((item) => item.includes("أرقامك القياسية")),
      ...steps("en").filter((item) => item.includes("personal bests")),
    ];
    expect(personalBest).toHaveLength(2);
    for (const item of personalBest) {
      expect(item).not.toMatch(/\[\d+\]|review|study|مراجعة|دراسة|توصي/u);
    }
  });
});
