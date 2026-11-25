import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleView } from "@/components/blog/article-view";
import { JsonLd } from "@/components/json-ld";
import { PageShell } from "@/components/page-shell";
import { articlePath, ROUTES } from "@/config/routes";
import { articleLocales, relatedArticles } from "@/content/blog/visibility";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale, LOCALES, type Locale } from "@/i18n/locales";
import { findReviewer, getVisibleArticle, getVisibleArticles } from "@/server/blog";
import { pageMetadata } from "@/server/metadata";
import { siteIdentity } from "@/server/site-identity";
import { articleGraph } from "@/server/structured-data";

type Props = PageProps<"/[locale]/blog/[slug]">;

/** المقال الظاهر في الوضع الحالي بترجمة لغة الزائر، أو لا شيء (404). */
async function resolve(params: Props["params"]) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) {
    return undefined;
  }
  const article = getVisibleArticle(slug);
  const translation = article?.translations[locale];
  return article === undefined || translation === undefined
    ? undefined
    : { locale, article, translation };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await resolve(params);
  if (found === undefined) {
    return {};
  }
  const { locale, article, translation } = found;
  return pageMetadata({
    locale,
    path: articlePath(article.slug),
    title: translation.title,
    description: translation.description,
    locales: articleLocales(article, LOCALES),
    article: {
      modifiedTime: article.updatedAt,
      ...(article.publishedAt === undefined ? {} : { publishedTime: article.publishedAt }),
    },
    noindex: article.status !== "published",
  });
}

function crumbs(locale: Locale, title: string, slug: string) {
  const { nav, blog } = getDictionary(locale);
  return [
    { name: nav.home, path: ROUTES.home },
    { name: blog.title, path: ROUTES.blog },
    { name: title, path: articlePath(slug) },
  ];
}

export default async function ArticlePage({ params }: Props) {
  const found = await resolve(params);
  if (found === undefined) {
    notFound();
  }
  const { locale, article, translation } = found;
  const dictionary = getDictionary(locale);
  const reviewer = findReviewer(article.reviewerId);
  const graph = articleGraph(siteIdentity(locale), {
    article,
    translation,
    reviewer,
    crumbs: crumbs(locale, translation.title, article.slug),
  });
  return (
    <PageShell locale={locale} path={articlePath(article.slug)}>
      <ArticleView
        article={article}
        translation={translation}
        reviewer={reviewer}
        related={relatedArticles(article, getVisibleArticles(), locale)}
        locale={locale}
        dictionary={dictionary}
      />
      <JsonLd data={graph} />
    </PageShell>
  );
}
