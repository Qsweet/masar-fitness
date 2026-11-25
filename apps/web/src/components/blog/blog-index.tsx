import Link from "next/link";
import { ButtonLink } from "@/components/ui/button-link";
import { articlePath, ROUTES } from "@/config/routes";
import { readingMinutes } from "@/content/blog/reading-time";
import { TOPIC_IDS, topicText } from "@/content/blog/topics";
import type { Article, ArticleTranslation } from "@/content/blog/types";
import { countText } from "@/i18n/count";
import { formatDate } from "@/i18n/dates";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/fill";
import { localizedPath, type Locale } from "@/i18n/locales";
import { cx } from "@/lib/cx";
import styles from "./blog-index.module.css";

type Listed = Article & { readonly translation: ArticleTranslation };

interface Props {
  readonly articles: readonly Listed[];
  readonly locale: Locale;
  readonly dictionary: Dictionary;
}

function ArticleCard({
  article,
  locale,
  dictionary,
}: { readonly article: Listed } & Omit<Props, "articles">) {
  const { blog } = dictionary;
  const minutes = countText(readingMinutes(article.translation, locale), blog.minutes);
  return (
    <li className={styles.card}>
      {article.status === "draft" ? <p className={styles.draft}>{blog.draftBanner}</p> : null}
      <h3 className={styles.cardTitle}>
        <Link href={localizedPath(locale, articlePath(article.slug))}>
          {article.translation.title}
        </Link>
      </h3>
      <p>{article.translation.description}</p>
      <p className={cx("muted", "small")}>
        <time dateTime={article.updatedAt}>
          {fill(blog.updated, { date: formatDate(article.updatedAt, locale) })}
        </time>{" "}
        / {fill(blog.readingTime, { minutes })}
      </p>
    </li>
  );
}

/** فهرس المدونة مجمّعًا بالموضوع بترتيب TOPIC_IDS، ولا يظهر موضوع بلا مقال. */
export function BlogIndex({ articles, locale, dictionary }: Props) {
  const groups = TOPIC_IDS.map((topic) => ({
    topic,
    items: articles.filter((article) => article.topic === topic),
  })).filter((group) => group.items.length > 0);
  return (
    <div className="container">
      {groups.map(({ topic, items }) => {
        const text = topicText(dictionary, topic);
        return (
          <section key={topic} aria-labelledby={`topic-${topic}`} className="section">
            <h2 id={`topic-${topic}`} className="title-block">
              {text.label}
            </h2>
            <p className="muted">{text.lead}</p>
            <ul className={styles.cards}>
              {items.map((article) => (
                <ArticleCard
                  key={article.slug}
                  article={article}
                  locale={locale}
                  dictionary={dictionary}
                />
              ))}
            </ul>
          </section>
        );
      })}
      <aside className={styles.tool} aria-label={dictionary.tools.costPerVisit.title}>
        <p className={styles.toolTitle}>{dictionary.tools.costPerVisit.title}</p>
        <p>{dictionary.tools.costPerVisit.lead}</p>
        <ButtonLink href={localizedPath(locale, ROUTES.costPerVisit)} variant="yellow">
          {dictionary.tools.footerLink}
        </ButtonLink>
      </aside>
    </div>
  );
}
