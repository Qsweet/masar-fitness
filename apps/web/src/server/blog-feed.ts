import { articlePath, ROUTES } from "@/config/routes";
import type { Article } from "@/content/blog/types";
import { articlesInLocale, isPublished } from "@/content/blog/visibility";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/fill";
import { localizedPath, type Locale } from "@/i18n/locales";
import { buildRss } from "./rss";

/**
 * خلاصة المدونة بلغة واحدة، بنصوص المحتوى المنشور (`getPublishedContent`). المسودات تُستبعد هنا مهما مُرِّر (كخريطة الموقع وllms.txt).
 * بلا مقال منشور بهذه اللغة ⇒ undefined (المسار يرد 404).
 */
export function blogFeed(
  origin: string,
  locale: Locale,
  articles: readonly Article[],
  dictionary: Dictionary,
): string | undefined {
  const published = articlesInLocale(articles.filter(isPublished), locale);
  if (published.length === 0) {
    return undefined;
  }
  const url = (path: string) => `${origin}${localizedPath(locale, path)}`;
  return buildRss({
    title: fill(dictionary.blog.feedTitle, { club: dictionary.club.name }),
    url: url(ROUTES.blog),
    feedUrl: url(`${ROUTES.blog}/feed.xml`),
    description: dictionary.blog.metaDescription,
    language: locale,
    items: published.map((article) => ({
      title: article.translation.title,
      url: url(articlePath(article.slug)),
      description: article.translation.summary ?? article.translation.description,
      publishedAt: article.publishedAt ?? article.updatedAt,
    })),
  });
}
