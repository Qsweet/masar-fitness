import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogIndex } from "@/components/blog/blog-index";
import { PageIntro } from "@/components/page-intro";
import { PageShell } from "@/components/page-shell";
import { PHOTOS } from "@/config/photos";
import { ROUTES } from "@/config/routes";
import { articlesInLocale } from "@/content/blog/visibility";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/locales";
import { getVisibleArticles, visibleBlogLocales } from "@/server/blog";
import { pageMetadata } from "@/server/metadata";

type Props = PageProps<"/[locale]/blog">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) {
    return {};
  }
  const { blog } = getDictionary(locale);
  return pageMetadata({
    locale,
    path: ROUTES.blog,
    title: blog.title,
    description: blog.metaDescription,
    locales: visibleBlogLocales(),
  });
}

/** فهرس المدونة. بلا مقال ظاهر بهذه اللغة ⇒ 404، لا صفحة فارغة. */
export default async function BlogPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const articles = articlesInLocale(getVisibleArticles(), locale);
  if (articles.length === 0) {
    notFound();
  }
  const dictionary = getDictionary(locale);
  return (
    <PageShell locale={locale} path={ROUTES.blog}>
      <PageIntro
        title={dictionary.blog.title}
        lead={dictionary.blog.intro}
        photo={PHOTOS.dumbbellRacks}
      />
      <BlogIndex articles={articles} locale={locale} dictionary={dictionary} />
    </PageShell>
  );
}
