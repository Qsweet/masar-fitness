import { describe, expect, it } from "vitest";
import { article, draft, translation } from "@/test/blog-fixtures";
import { readingMinutes, countWords } from "./reading-time";
import {
  articleLocales,
  articlesInLocale,
  localesWithArticles,
  relatedArticles,
  visibleArticles,
} from "./visibility";

const published = article({ slug: "published" });
const pending = draft({ slug: "pending" });

describe("قاعدة الظهور", () => {
  it("الإنتاج (قابل للفهرسة): المنشور فقط", () => {
    expect(visibleArticles([published, pending], true).map((a) => a.slug)).toEqual(["published"]);
  });

  it("المعاينة: المنشور والمسودات", () => {
    expect(visibleArticles([published, pending], false).map((a) => a.slug)).toEqual([
      "published",
      "pending",
    ]);
  });

  it("لا مقال ظاهر ⇒ لا لغة للمدونة (فلا رابط ولا صفحة)", () => {
    expect(localesWithArticles(visibleArticles([pending], true), ["ar", "en"])).toEqual([]);
    expect(localesWithArticles([published], ["ar", "en"])).toEqual(["ar"]);
  });

  it("لغات المقال هي ترجماته الموجودة فقط", () => {
    expect(articleLocales(published, ["ar", "en"])).toEqual(["ar"]);
    const both = article({ translations: { ar: translation(), en: translation() } });
    expect(articleLocales(both, ["ar", "en"])).toEqual(["ar", "en"]);
  });

  it("المقالات بلغة القارئ، الأحدث تحديثًا أولًا", () => {
    const older = article({ slug: "older", updatedAt: "2026-11-02" });
    const newer = article({ slug: "newer", updatedAt: "2026-11-20" });
    expect(articlesInLocale([older, newer], "ar").map((a) => a.slug)).toEqual(["newer", "older"]);
    expect(articlesInLocale([older, newer], "en")).toEqual([]);
  });

  it("ذات الصلة: الموضوع نفسه بلا المقال الحالي، ثلاثة على الأكثر", () => {
    const others = ["a", "b", "c", "d"].map((slug) => article({ slug }));
    const otherTopic = article({ slug: "e", topic: "nutrition" });
    const related = relatedArticles(published, [published, ...others, otherTopic], "ar");
    expect(related).toHaveLength(3);
    expect(related.map((a) => a.slug)).not.toContain("published");
    expect(related.map((a) => a.slug)).not.toContain("e");
  });
});

describe("وقت القراءة", () => {
  it("يعد الكلمات لا الرموز", () => {
    expect(countWords("كلمة  أخرى — 3 ثم")).toBe(4);
  });

  it("دقيقة على الأقل، ويقرَّب للأعلى حسب سرعة كل لغة", () => {
    expect(readingMinutes(translation(), "ar")).toBe(1);
    const words = (count: number) => Array.from({ length: count }, () => "كلمة").join(" ");
    const long = translation({
      summary: words(276),
      keyTakeaways: [],
      sections: [{ id: "s", heading: "", blocks: [{ type: "list", items: [words(1)] }] }],
    });
    // 277 كلمة ÷ 138 = 2.007 ⇒ 3 دقائق بالعربية، و÷ 228 = 1.2 ⇒ دقيقتان بالإنجليزية
    expect(readingMinutes(long, "ar")).toBe(3);
    expect(readingMinutes(long, "en")).toBe(2);
  });
});
