import Image from "next/image";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button-link";
import { PHOTOS, type PhotoKey } from "@/config/photos";
import { articlePath, ROUTES } from "@/config/routes";
import { readingMinutes } from "@/content/blog/reading-time";
import { TOPIC_IDS, topicText, type TopicId } from "@/content/blog/topics";
import type { Article, ArticleTranslation } from "@/content/blog/types";
import { countText } from "@/i18n/count";
import { formatDate } from "@/i18n/dates";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/fill";
import { localizedPath, type Locale } from "@/i18n/locales";
import styles from "./blog-index.module.css";

type Listed = Article & { readonly translation: ArticleTranslation };

interface Props {
  readonly articles: readonly Listed[];
  readonly locale: Locale;
  readonly dictionary: Dictionary;
}

/**
 * صور البطاقات من صور النادي حسب الموضوع، بالتناوب داخل الموضوع الواحد حتى لا تتكرر صورة متجاورة.
 * الصورة زخرفية (alt فارغ): لا تضيف معلومة عن المقال، والعنوان بجانبها.
 */
const TOPIC_PHOTOS: Readonly<Record<TopicId, readonly [PhotoKey, ...PhotoKey[]]>> = {
  choosing: ["trainerPortrait", "legPress"],
  training: ["functionalSquat", "latPulldown", "coachFloor"],
  recovery: ["pool"],
  nutrition: ["functionalPress"],
};

function topicPhoto(topic: TopicId, index: number): PhotoKey {
  const photos = TOPIC_PHOTOS[topic];
  return photos[index % photos.length] ?? photos[0];
}

function ArticleCard({
  article,
  photo,
  locale,
  dictionary,
}: { readonly article: Listed; readonly photo: PhotoKey } & Omit<Props, "articles">) {
  const { blog } = dictionary;
  const minutes = countText(readingMinutes(article.translation, locale), blog.minutes);
  return (
    <li className={styles.card}>
      <div className={styles.photo}>
        <Image
          src={PHOTOS[photo]}
          alt=""
          fill
          placeholder="blur"
          sizes="(min-width: 48rem) 45vw, 100vw"
        />
        <span className={styles.chip}>{topicText(dictionary, article.topic).label}</span>
      </div>
      <div className={styles.body}>
        <h3 className={styles.cardTitle}>
          <Link href={localizedPath(locale, articlePath(article.slug))}>
            {article.translation.title}
          </Link>
        </h3>
        <p>{article.translation.description}</p>
        <p className={styles.meta}>
          {article.publishedAt === undefined ? null : (
            <>
              <time dateTime={article.publishedAt}>
                {fill(blog.published, { date: formatDate(article.publishedAt, locale) })}
              </time>{" "}
              /{" "}
            </>
          )}
          {fill(blog.readingTime, { minutes })}
        </p>
      </div>
    </li>
  );
}

/**
 * تنبيه واحد أعلى الفهرس حين تُعرض مسودات (نسخة المعاينة فقط): يقول ما هي ومتى حُدّثت آخر مرة،
 * بدل شارة وتاريخ مكررين على كل بطاقة. التاريخ حقيقي: أحدث updatedAt بين المسودات.
 */
function DraftsNotice({ articles, locale, dictionary }: Props) {
  const drafts = articles.filter((article) => article.status === "draft");
  const latest = drafts
    .map((article) => article.updatedAt)
    .sort()
    .at(-1);
  if (latest === undefined) {
    return null;
  }
  const { blog } = dictionary;
  return (
    <p role="note" className={styles.notice}>
      <strong>{blog.draftsNotice}</strong> {blog.draftNote}{" "}
      <time dateTime={latest}>
        {fill(blog.draftsUpdated, { date: formatDate(latest, locale) })}
      </time>
    </p>
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
      <DraftsNotice articles={articles} locale={locale} dictionary={dictionary} />
      {groups.map(({ topic, items }) => {
        const text = topicText(dictionary, topic);
        return (
          <section key={topic} aria-labelledby={`topic-${topic}`} className={styles.topic}>
            <h2 id={`topic-${topic}`} className="title-block">
              {text.label}
            </h2>
            <p className="muted">{text.lead}</p>
            <ul className={styles.cards}>
              {items.map((article, index) => (
                <ArticleCard
                  key={article.slug}
                  article={article}
                  photo={topicPhoto(topic, index)}
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
