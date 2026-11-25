import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { articlePath } from "@/config/routes";
import { articleCrumbs } from "@/content/blog/crumbs";
import { topicText } from "@/content/blog/topics";
import type { Article, ArticleTranslation, Reviewer } from "@/content/blog/types";
import { countText } from "@/i18n/count";
import { formatDate } from "@/i18n/dates";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill, fillNodes } from "@/i18n/fill";
import { localizedPath, type Locale } from "@/i18n/locales";
import { cx } from "@/lib/cx";
import styles from "./article.module.css";

interface Context {
  readonly locale: Locale;
  readonly dictionary: Dictionary;
}

/**
 * فوق العنوان: مسار التنقل الظاهر، وهو نفسه BreadcrumbList (articleCrumbs)، آخره الصفحة الحالية
 * بلا رابط (aria-current). ثم اسم الموضوع.
 */
export function ArticleTrail({
  article,
  title,
  locale,
  dictionary,
}: { readonly article: Article; readonly title: string } & Context) {
  const crumbs = articleCrumbs(dictionary, title, article.slug);
  const current = crumbs.at(-1);
  return (
    <>
      <nav aria-label={dictionary.blog.breadcrumb}>
        <ol className={styles.trail}>
          {crumbs.slice(0, -1).map((crumb) => (
            <li key={crumb.path}>
              <Link href={localizedPath(locale, crumb.path)}>{crumb.name}</Link>
            </li>
          ))}
          {current === undefined ? null : (
            // العنوان الطويل يُقص بصريًا بعلامة الحذف، ونصه كاملًا في الصفحة لقارئ الشاشة
            <li aria-current="page" className={styles.trailCurrent}>
              {current.name}
            </li>
          )}
        </ol>
      </nav>
      <p className={styles.topic}>{topicText(dictionary, article.topic).label}</p>
    </>
  );
}

interface MetaProps extends Context {
  readonly article: Article;
  readonly reviewer: Reviewer | undefined;
  readonly minutes: number;
}

/** تحت العنوان: تواريخ حقيقية، ووقت القراءة، ومن راجعه بصفته وتاريخ مراجعته. */
export function ArticleMeta({ article, reviewer, minutes, locale, dictionary }: MetaProps) {
  const { blog } = dictionary;
  const date = (iso: string) => formatDate(iso, locale);
  return (
    <div className={styles.meta}>
      <p className={styles.metaLine}>
        {article.publishedAt === undefined ? null : (
          <time dateTime={article.publishedAt}>
            {fill(blog.published, { date: date(article.publishedAt) })}
          </time>
        )}
        <time dateTime={article.updatedAt}>
          {fill(blog.updated, { date: date(article.updatedAt) })}
        </time>
        <span>{fill(blog.readingTime, { minutes: countText(minutes, blog.minutes) })}</span>
      </p>
      {reviewer === undefined || article.reviewedAt === undefined ? null : (
        <p className={styles.reviewer}>
          {fill(blog.reviewed, {
            name: reviewer.name[locale],
            credential: reviewer.credential[locale],
            date: date(article.reviewedAt),
          })}
        </p>
      )}
    </div>
  );
}

/** الجواب أولًا: الخلاصة والنقاط الرئيسية في كتلة صفراء قبل أي تفصيل. */
export function SummaryBox({
  translation,
  dictionary,
}: {
  readonly translation: ArticleTranslation;
  readonly dictionary: Dictionary;
}) {
  if (translation.summary === undefined && translation.keyTakeaways.length === 0) {
    return null;
  }
  return (
    <section id="summary" aria-labelledby="summary-title" className={styles.summary}>
      <h2 id="summary-title" className={styles.summaryTitle}>
        {dictionary.blog.summaryTitle}
      </h2>
      {translation.summary === undefined ? null : (
        <p className={styles.summaryText}>{translation.summary}</p>
      )}
      {translation.keyTakeaways.length === 0 ? null : (
        <>
          <p className={styles.takeawaysTitle}>{dictionary.blog.takeawaysTitle}</p>
          <ul className={styles.takeaways}>
            {translation.keyTakeaways.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function TableOfContents({
  translation,
  dictionary,
}: {
  readonly translation: ArticleTranslation;
  readonly dictionary: Dictionary;
}) {
  return (
    <nav id="toc" aria-labelledby="toc-title" className={styles.toc}>
      <h2 id="toc-title" className={styles.smallTitle}>
        {dictionary.blog.tocTitle}
      </h2>
      <ol>
        {translation.sections.map((section) => (
          <li key={section.id}>
            <a href={`#${section.id}`}>{section.heading}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Sources({
  translation,
  locale,
  dictionary,
}: { readonly translation: ArticleTranslation } & Context) {
  if (translation.sources.length === 0) {
    return null;
  }
  return (
    <section id="sources" aria-labelledby="sources-title" className={styles.block}>
      <h2 id="sources-title" className="title-block">
        {dictionary.blog.sourcesTitle}
      </h2>
      <ol className={styles.sources}>
        {translation.sources.map((source) => (
          <li key={source.url}>
            <a href={source.url} rel="noopener noreferrer" className={styles.sourceTitle}>
              {/* لغة المرجع حين تختلف عن لغة الصفحة: ينطقه قارئ الشاشة بلغته (WCAG 3.1.2) */}
              <bdi lang={source.lang}>{source.title}</bdi>
            </a>
            <span className={cx("muted", styles.sourceLine)}>
              {fillNodes<ReactNode>(dictionary.blog.sourceLine, {
                // المرجع قد يكون بلغة أخرى: عزل اتجاهه حتى لا تنقلب الفواصل والأرقام حوله
                publisher: <bdi lang={source.publisherLang}>{source.publisher}</bdi>,
                year: String(source.year),
                date: formatDate(source.accessed, locale),
              }).map((part, index) => (
                <Fragment key={index}>{part}</Fragment>
              ))}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

type Listed = Article & { readonly translation: ArticleTranslation };

export function Related({
  articles,
  locale,
  dictionary,
}: { readonly articles: readonly Listed[] } & Context) {
  if (articles.length === 0) {
    return null;
  }
  return (
    <section id="related" aria-labelledby="related-title" className={styles.block}>
      <h2 id="related-title" className="title-block">
        {dictionary.blog.relatedTitle}
      </h2>
      <ul className={styles.related}>
        {articles.map((article) => (
          <li key={article.slug}>
            <Link href={localizedPath(locale, articlePath(article.slug))}>
              {article.translation.title}
            </Link>
            <p className="muted">{article.translation.description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
