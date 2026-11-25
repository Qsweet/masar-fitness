import { describe, expect, it } from "vitest";
import { ARTICLES, SITE_VALIDATION_CONTEXT } from "@/content/blog/site";
import { article, draft, TEST_CONTEXT, translation, without } from "@/test/blog-fixtures";
import type { Article, Block, Source } from "./types";
import {
  articleProblems,
  assertValidArticles,
  countSentences,
  InvalidArticlesError,
} from "./validate";

function problemsOf(...articles: Article[]): string[] {
  return articleProblems(articles, TEST_CONTEXT);
}

function withBlocks(blocks: Block[], extra: Partial<Article> = {}): Article {
  return article({
    translations: { ar: translation({ sections: [{ id: "s", heading: "سؤال؟", blocks }] }) },
    ...extra,
  });
}

function linkTo(href: string): Block {
  return { type: "paragraph", segments: [{ type: "link", text: "رابط", href }] };
}

describe("المقالات الحقيقية في المستودع", () => {
  it("كلها تجتاز الشكل وبوابة النشر", () => {
    expect(articleProblems(ARTICLES, SITE_VALIDATION_CONTEXT)).toEqual([]);
  });
});

describe("بوابة النشر", () => {
  it("مقال منشور كامل يجتازها", () => {
    expect(problemsOf(article())).toEqual([]);
  });

  it("المنشور يحتاج مراجعًا من السجل وتاريخ مراجعة وتاريخ نشر", () => {
    expect(problemsOf(article({ reviewerId: "someone-else" }))).toEqual([
      expect.stringContaining("reviewer is not in the reviewers registry"),
    ]);
    const bare = without(article(), "reviewerId", "reviewedAt", "publishedAt");
    const problems = problemsOf({ ...bare, status: "published" });
    expect(problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining("no publishedAt"),
        expect.stringContaining("no reviewedAt"),
        expect.stringContaining("reviewers registry"),
      ]),
    );
  });

  it("المنشور يحتاج مرجعًا وخلاصة من جملتين أو ثلاث ونقاطًا رئيسية", () => {
    const noSummary = without(translation(), "summary");
    expect(problemsOf(article({ translations: { ar: noSummary } }))).toEqual([
      expect.stringContaining("has no summary"),
    ]);
    expect(problemsOf(article({ translations: { ar: translation({ sources: [] }) } }))).toEqual([
      expect.stringContaining("has no sources"),
    ]);
    expect(
      problemsOf(article({ translations: { ar: translation({ summary: "جملة واحدة فقط." }) } })),
    ).toEqual([expect.stringContaining("1 sentences")]);
    expect(
      problemsOf(article({ translations: { ar: translation({ keyTakeaways: [] }) } })),
    ).toEqual([expect.stringContaining("no key takeaways")]);
  });

  it("المسودة لا تحتاج مراجعًا ولا مراجع ولا خلاصة", () => {
    const noSummary = without(translation({ sources: [], keyTakeaways: [] }), "summary");
    expect(problemsOf(draft({ translations: { ar: noSummary } }))).toEqual([]);
  });

  it("تاريخ التحديث لا يسبق تاريخ النشر", () => {
    expect(problemsOf(article({ publishedAt: "2026-11-10", updatedAt: "2026-11-01" }))).toEqual([
      expect.stringContaining("updatedAt is before publishedAt"),
    ]);
  });

  it("assertValidArticles ترمي بقائمة المشكلات", () => {
    expect(() => assertValidArticles([article({ reviewerId: "x" })], TEST_CONTEXT)).toThrow(
      InvalidArticlesError,
    );
    expect(assertValidArticles([article()], TEST_CONTEXT)).toHaveLength(1);
  });
});

describe("الشكل", () => {
  it("المعرّف حروف لاتينية صغيرة بشرطات وفريد", () => {
    for (const slug of ["Bad", "with space", "عربي", "-lead", "trail-", "a--b"]) {
      expect(problemsOf(article({ slug })), slug).not.toEqual([]);
    }
    expect(problemsOf(article(), article())).toEqual([expect.stringContaining("duplicate slug")]);
  });

  it("الوصف 155 حرفًا على الأكثر، والتواريخ ISO حقيقية", () => {
    const long = translation({ description: "ا".repeat(156) });
    expect(problemsOf(article({ translations: { ar: long } }))).not.toEqual([]);
    expect(problemsOf(article({ updatedAt: "2026-02-30" }))).not.toEqual([]);
    expect(problemsOf(article({ publishedAt: "25/11/2026" }))).not.toEqual([]);
  });

  it("مقال بلا أي ترجمة مرفوض", () => {
    expect(problemsOf(article({ translations: {} }))).not.toEqual([]);
  });

  it("معرّفات الأقسام فريدة وغير محجوزة للصفحة", () => {
    const section = { id: "same", heading: "سؤال؟", blocks: [linkTo("/")] };
    const twice = translation({ sections: [section, section] });
    expect(problemsOf(article({ translations: { ar: twice } }))).toEqual([
      expect.stringContaining("duplicate section id"),
    ]);
    const reserved = translation({ sections: [{ ...section, id: "summary" }] });
    expect(problemsOf(article({ translations: { ar: reserved } }))).toEqual([
      expect.stringContaining("reserved"),
    ]);
  });

  it("صفوف الجدول بعدد أعمدة الرأس، وتوصية واحدة على الأكثر في النص", () => {
    const table: Block = { type: "table", caption: "ج", head: ["أ", "ب"], rows: [["1"]] };
    expect(problemsOf(withBlocks([table]))).toEqual([expect.stringContaining("table")]);
    const uncaptioned: Block = { type: "table", head: ["أ", "ب"], rows: [["1", "2"]] };
    expect(problemsOf(withBlocks([uncaptioned]))).toEqual([]);
    const recommendation: Block = { type: "recommendation", kind: "memberships" };
    expect(problemsOf(withBlocks([recommendation, recommendation]))).toEqual([
      expect.stringContaining("at most one"),
    ]);
  });
});

describe("لغة المرجع وعناصر القوائم", () => {
  const source: Source = {
    title: "Source title",
    publisher: "Publisher",
    url: "https://example.org/guide",
    year: 2024,
    accessed: "2026-11-01",
  };

  it("lang وpublisherLang وسم BCP 47 قانوني إن وُجد", () => {
    for (const lang of ["en", "ar", "en-GB"]) {
      const valid = translation({ sources: [{ ...source, lang, publisherLang: lang }] });
      expect(problemsOf(article({ translations: { ar: valid } })), lang).toEqual([]);
    }
    for (const lang of ["", "english", "EN", "en_GB", "ar-", "<b>"]) {
      const invalid = translation({ sources: [{ ...source, lang }] });
      expect(problemsOf(article({ translations: { ar: invalid } })), lang).toEqual([
        expect.stringContaining("BCP 47"),
      ]);
    }
  });

  it("عناصر القائمة والخطوات والنقاط الرئيسية لا تتكرر (النص مفتاح العنصر)", () => {
    for (const type of ["list", "steps"] as const) {
      expect(problemsOf(withBlocks([{ type, items: ["أ", "أ"] }])), type).toEqual([
        expect.stringContaining("distinct"),
      ]);
    }
    const repeated = translation({ keyTakeaways: ["نقطة", "نقطة"] });
    expect(problemsOf(article({ translations: { ar: repeated } }))).toEqual([
      expect.stringContaining("distinct"),
    ]);
  });
});

describe("الروابط", () => {
  it("الخارجية https إلى نطاق فقط", () => {
    for (const href of [
      "http://example.org",
      "javascript:alert(1)",
      "https://127.0.0.1/x",
      "mailto:a@b.co",
    ]) {
      expect(problemsOf(withBlocks([linkTo(href)])), href).not.toEqual([]);
    }
    expect(problemsOf(withBlocks([linkTo("https://www.who.int/news")]))).toEqual([]);
  });

  it("الداخلية تصل إلى مسار حقيقي بلا بادئة لغة", () => {
    expect(problemsOf(withBlocks([linkTo("/tools/cost-per-visit?visits=3")]))).toEqual([]);
    expect(problemsOf(withBlocks([linkTo("/#water")]))).toEqual([]);
    for (const href of ["/no-such-page", "/en/memberships", "/ar", "//evil.example", "/blog/x"]) {
      expect(problemsOf(withBlocks([linkTo(href)])), href).not.toEqual([]);
    }
  });

  it("الرابط إلى مقال: موجود بلغة القارئ، ومنشور إن كان المصدر منشورًا", () => {
    const target = draft({ slug: "target" });
    const linking = withBlocks([linkTo("/blog/target")], { slug: "source" });
    expect(problemsOf(linking, target)).toEqual([expect.stringContaining("unpublished target")]);
    expect(problemsOf(linking, article({ slug: "target" }))).toEqual([]);
    const englishOnly = article({ slug: "target", translations: { en: translation() } });
    expect(problemsOf(linking, englishOnly)).toEqual([
      expect.stringContaining("no ar translation"),
    ]);
  });
});

describe("countSentences", () => {
  it("يعد الجمل بالنقطة وعلامتي الاستفهام والتعجب، ولا يعد النقطة العشرية", () => {
    expect(countSentences("أولى. ثانية؟ ثالثة!")).toBe(3);
    expect(countSentences("الوزن 2.5 كجم. ثم ماذا")).toBe(2);
    expect(countSentences("")).toBe(0);
  });
});
