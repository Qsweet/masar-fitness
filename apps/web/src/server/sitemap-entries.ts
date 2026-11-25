import type { MetadataRoute } from "next";
import { articlePath, planPath, ROUTES } from "@/config/routes";
import type { Article } from "@/content/blog/types";
import { articleLocales, articlesInLocale, isPublished } from "@/content/blog/visibility";
import { LOCALES, localizedPath, type Locale } from "@/i18n/locales";
import { alternateLanguages } from "./metadata";

export interface SitemapInput {
  readonly origin: string;
  /** معرّفات الاشتراكات المعروضة للبيع الآن */
  readonly planSlugs: readonly string[];
  /** كل المقالات؛ المسودات تُستبعد هنا مهما مُرِّر */
  readonly articles: readonly Article[];
}

type Entry = MetadataRoute.Sitemap[number];

/** رابط لكل لغة موجودة، ولكل منها بدائله المتبادلة. lastModified يُذكر فقط حين يُعرف تاريخ حقيقي. */
function localizedEntries(
  origin: string,
  path: string,
  locales: readonly Locale[],
  lastModified?: (locale: Locale) => string | undefined,
): Entry[] {
  const languages = alternateLanguages(origin, path, locales);
  return locales.map((locale) => {
    const modified = lastModified?.(locale);
    return {
      url: `${origin}${localizedPath(locale, path)}`,
      ...(modified === undefined ? {} : { lastModified: modified }),
      alternates: { languages },
    };
  });
}

/**
 * روابط خريطة الموقع: المعتمدة فقط (بلا معاملات)، وصفحات 200 فقط.
 * المدونة ومقالاتها من المنشور وحده: المسودة لا تظهر في الخريطة أبدًا، ولا فهرس مدونة بلا مقال منشور.
 */
export function sitemapEntries({
  origin,
  planSlugs,
  articles,
}: SitemapInput): MetadataRoute.Sitemap {
  const published = articles.filter(isPublished);
  const blogLocales = LOCALES.filter((locale) => articlesInLocale(published, locale).length > 0);
  const latestIn = (locale: Locale) => articlesInLocale(published, locale)[0]?.updatedAt;
  return [
    ...localizedEntries(origin, ROUTES.home, LOCALES),
    ...localizedEntries(origin, ROUTES.memberships, LOCALES),
    ...planSlugs.flatMap((slug) => localizedEntries(origin, planPath(slug), LOCALES)),
    ...localizedEntries(origin, ROUTES.costPerVisit, LOCALES),
    ...localizedEntries(origin, ROUTES.blog, blogLocales, latestIn),
    ...published.flatMap((article) =>
      localizedEntries(
        origin,
        articlePath(article.slug),
        articleLocales(article, LOCALES),
        () => article.updatedAt,
      ),
    ),
  ];
}
