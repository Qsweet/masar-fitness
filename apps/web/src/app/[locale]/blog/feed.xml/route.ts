import { articlePath, ROUTES } from "@/config/routes";
import { articlesInLocale } from "@/content/blog/visibility";
import { getDictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/fill";
import { isLocale, localizedPath } from "@/i18n/locales";
import { getPublishedArticles } from "@/server/blog";
import { getEnv } from "@/server/env";
import { buildRss } from "@/server/rss";

const HTTP_NOT_FOUND = 404;

// الأصل والمقالات تُقرأ عند الطلب (الإعداد يختلف بين النشرين)
export const dynamic = "force-dynamic";

/** خلاصة RSS 2.0 لكل لغة، للمنشور فقط. بلا مقال منشور بهذه اللغة ⇒ 404. */
export async function GET(_request: Request, context: RouteContext<"/[locale]/blog/feed.xml">) {
  const { locale } = await context.params;
  const articles = isLocale(locale) ? articlesInLocale(getPublishedArticles(), locale) : [];
  if (!isLocale(locale) || articles.length === 0) {
    return new Response(null, { status: HTTP_NOT_FOUND });
  }
  const origin = getEnv().SITE_URL;
  const url = (path: string) => `${origin}${localizedPath(locale, path)}`;
  const dictionary = getDictionary(locale);
  const xml = buildRss({
    title: fill(dictionary.blog.feedTitle, { club: dictionary.club.name }),
    url: url(ROUTES.blog),
    feedUrl: url(`${ROUTES.blog}/feed.xml`),
    description: dictionary.blog.metaDescription,
    language: locale,
    items: articles.map((article) => ({
      title: article.translation.title,
      url: url(articlePath(article.slug)),
      description: article.translation.summary ?? article.translation.description,
      publishedAt: article.publishedAt ?? article.updatedAt,
    })),
  });
  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
