import type { Article, ArticleTranslation, Reviewer } from "@/content/blog/types";
import type { ValidationContext } from "@/content/blog/validate";

/** بيانات اختبار فقط: مراجع ومقالات متخيَّلة لا تدخل الموقع. */
export const TEST_REVIEWER: Reviewer = {
  id: "test-reviewer",
  name: { ar: "مراجع الاختبار", en: "Test Reviewer" },
  role: { ar: "مدرب", en: "Coach" },
  credential: { ar: "شهادة اختبار", en: "Test certificate" },
};

export const TEST_CONTEXT: ValidationContext = {
  reviewers: [TEST_REVIEWER],
  staticPaths: ["/", "/memberships", "/blog", "/tools/cost-per-visit"],
};

export function translation(overrides: Partial<ArticleTranslation> = {}): ArticleTranslation {
  return {
    title: "كم مرة أتمرن في الأسبوع؟",
    description: "وصف قصير للمقال.",
    summary: "الجملة الأولى من الخلاصة. والجملة الثانية منها.",
    keyTakeaways: ["نقطة أولى"],
    sections: [
      {
        id: "how-often",
        heading: "كم مرة؟",
        blocks: [
          {
            type: "paragraph",
            segments: [
              { type: "text", text: "انظر " },
              { type: "link", text: "الاشتراكات", href: "/memberships#compare" },
            ],
          },
        ],
      },
    ],
    sources: [
      {
        title: "Source title",
        publisher: "Publisher",
        url: "https://example.org/guide",
        year: 2024,
        accessed: "2026-11-01",
      },
    ],
    ...overrides,
  };
}

export function article(overrides: Partial<Article> = {}): Article {
  return {
    slug: "how-often-to-train",
    topic: "training",
    status: "published",
    publishedAt: "2026-11-01",
    updatedAt: "2026-11-10",
    reviewedAt: "2026-11-05",
    reviewerId: TEST_REVIEWER.id,
    translations: { ar: translation() },
    ...overrides,
  };
}

/** نسخة من الكائن بلا مفاتيح معيّنة (لبناء مقال ينقصه حقل). */
export function without<T extends object, K extends keyof T>(value: T, ...keys: K[]): Omit<T, K> {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !(keys as PropertyKey[]).includes(key)),
  ) as Omit<T, K>;
}

export function draft(overrides: Partial<Article> = {}): Article {
  const base = without(article(), "publishedAt", "reviewedAt", "reviewerId");
  return { ...base, status: "draft", ...overrides };
}
