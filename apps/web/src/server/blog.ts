import "server-only";
import { ARTICLES, REVIEWERS, SITE_VALIDATION_CONTEXT } from "@/content/blog/site";
import type { Article, Reviewer } from "@/content/blog/types";
import { assertValidArticles } from "@/content/blog/validate";
import {
  articlesInLocale,
  isPublished,
  localesWithArticles,
  visibleArticles,
} from "@/content/blog/visibility";
import { isSiteIndexable } from "@/config/indexability";
import { LOCALES, type Locale } from "@/i18n/locales";

/**
 * التحقق عند تحميل الوحدة: البناء يحمّل كل صفحة (والترويسة في كل صفحة تستورد هذا الملف)،
 * فمقال يخالف بوابة النشر يُسقط البناء والخادم، ولا يُعرض ناقصًا بصمت.
 */
const ALL_ARTICLES = assertValidArticles(ARTICLES, SITE_VALIDATION_CONTEXT);

function siteIndexable(): boolean {
  return isSiteIndexable(process.env.SITE_INDEXABLE);
}

/** المقالات الظاهرة في الوضع الحالي (الإنتاج: المنشور فقط؛ المعاينة: والمسودات). */
export function getVisibleArticles(): readonly Article[] {
  return visibleArticles(ALL_ARTICLES, siteIndexable());
}

/** المنشور فقط، مهما كان الوضع: لخريطة الموقع والخلاصة وllms.txt. لا مسودة فيها أبدًا. */
export function getPublishedArticles(): readonly Article[] {
  return ALL_ARTICLES.filter(isPublished);
}

export function getVisibleArticle(slug: string): Article | undefined {
  return getVisibleArticles().find((article) => article.slug === slug);
}

/** هل للمدونة مقال ظاهر بهذه اللغة؟ وإلا لا رابط لها ولا صفحة (404). */
export function hasVisibleBlog(locale: Locale): boolean {
  return articlesInLocale(getVisibleArticles(), locale).length > 0;
}

export function visibleBlogLocales(): Locale[] {
  return localesWithArticles(getVisibleArticles(), LOCALES);
}

export function findReviewer(id: string | undefined): Reviewer | undefined {
  return REVIEWERS.find((reviewer) => reviewer.id === id);
}
