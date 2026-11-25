import { isLocale } from "@/i18n/locales";
import { blogFeed } from "@/server/blog-feed";
import { getPublishedArticles } from "@/server/blog";
import { getEnv } from "@/server/env";

const HTTP_NOT_FOUND = 404;

// الأصل والمقالات تُقرأ عند الطلب (الإعداد يختلف بين النشرين)
export const dynamic = "force-dynamic";

/** خلاصة RSS 2.0 لكل لغة، للمنشور فقط. بلا مقال منشور بهذه اللغة ⇒ 404. */
export async function GET(_request: Request, context: RouteContext<"/[locale]/blog/feed.xml">) {
  const { locale } = await context.params;
  const xml = isLocale(locale)
    ? blogFeed(getEnv().SITE_URL, locale, getPublishedArticles())
    : undefined;
  if (xml === undefined) {
    return new Response(null, { status: HTTP_NOT_FOUND });
  }
  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
