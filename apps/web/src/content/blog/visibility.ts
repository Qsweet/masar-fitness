import type { Locale } from "@/i18n/locales";
import type { Article, ArticleTranslation } from "./types";

/**
 * قاعدة الظهور: الإنتاج (الموقع قابل للفهرسة) يعرض المنشور فقط. نسخة المعاينة (غير قابلة للفهرسة)
 * تعرض المسودات أيضًا بشريط «مسودة» وnoindex، ليراجعها المدرب في مكانها.
 */
export function visibleArticles(
  articles: readonly Article[],
  siteIndexable: boolean,
): readonly Article[] {
  return siteIndexable ? articles.filter(isPublished) : articles;
}

export function isPublished(article: Article): boolean {
  return article.status === "published";
}

/** المقالات التي لها ترجمة بهذه اللغة، الأحدث تحديثًا أولًا. */
export function articlesInLocale(
  articles: readonly Article[],
  locale: Locale,
): readonly (Article & { readonly translation: ArticleTranslation })[] {
  return articles
    .flatMap((article) => {
      const translation = article.translations[locale];
      return translation === undefined ? [] : [{ ...article, translation }];
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** اللغات التي فيها مقال ظاهر واحد على الأقل: تحدد ظهور رابط المدونة وبدائل لغة الفهرس. */
export function localesWithArticles(
  articles: readonly Article[],
  locales: readonly Locale[],
): Locale[] {
  return locales.filter((locale) => articlesInLocale(articles, locale).length > 0);
}

/** لغات المقال الفعلية: لا يُذكر في hreflang إلا ترجمة موجودة. */
export function articleLocales(article: Article, locales: readonly Locale[]): Locale[] {
  return locales.filter((locale) => article.translations[locale] !== undefined);
}

const RELATED_LIMIT = 3;

/** مقالات من الموضوع نفسه بلغة القارئ، بلا المقال الحالي. */
export function relatedArticles(
  article: Article,
  visible: readonly Article[],
  locale: Locale,
): readonly (Article & { readonly translation: ArticleTranslation })[] {
  return articlesInLocale(
    visible.filter((other) => other.topic === article.topic && other.slug !== article.slug),
    locale,
  ).slice(0, RELATED_LIMIT);
}
