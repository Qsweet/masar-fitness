import { PageIntro } from "@/components/page-intro";
import { readingMinutes } from "@/content/blog/reading-time";
import type { Article, ArticleTranslation, Reviewer } from "@/content/blog/types";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/locales";
import {
  ArticleMeta,
  ArticleTrail,
  Related,
  Sources,
  SummaryBox,
  TableOfContents,
} from "./article-parts";
import { BlockView } from "./blocks";
import { MembershipRecommendation } from "./membership-recommendation";
import styles from "./article.module.css";

interface ArticleViewProps {
  readonly article: Article;
  readonly translation: ArticleTranslation;
  readonly reviewer: Reviewer | undefined;
  readonly related: readonly (Article & { readonly translation: ArticleTranslation })[];
  readonly locale: Locale;
  readonly dictionary: Dictionary;
}

/**
 * المقال كاملًا على الخادم: رأس أسود بالموضوع والعنوان والتواريخ والمراجع، ثم الخلاصة الصفراء،
 * والفهرس، والأقسام بعناوين أسئلة، والتوصية الحية في النهاية، والمراجع، ومقالات الموضوع نفسه.
 */
export function ArticleView(props: ArticleViewProps) {
  const { article, translation, reviewer, related, locale, dictionary } = props;
  const context = { locale, dictionary };
  return (
    <article>
      {article.status === "draft" ? (
        <p role="note" className={styles.draft}>
          <strong>{dictionary.blog.draftBanner}</strong> {dictionary.blog.draftNote}
        </p>
      ) : null}
      <PageIntro
        title={translation.title}
        lead={translation.description}
        before={<ArticleTrail article={article} {...context} />}
        size="article"
      >
        <ArticleMeta
          article={article}
          reviewer={reviewer}
          minutes={readingMinutes(translation, locale)}
          {...context}
        />
      </PageIntro>
      <div className="container">
        <div className={styles.body}>
          <SummaryBox translation={translation} dictionary={dictionary} />
          <TableOfContents translation={translation} dictionary={dictionary} />
          {translation.sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              aria-labelledby={`${section.id}-title`}
              className={styles.block}
            >
              <h2 id={`${section.id}-title`} className="title-block">
                {section.heading}
              </h2>
              {section.blocks.map((block, index) => (
                <BlockView key={index} block={block} {...context} />
              ))}
            </section>
          ))}
          <MembershipRecommendation {...context} />
          <Sources translation={translation} {...context} />
          <Related articles={related} {...context} />
        </div>
      </div>
    </article>
  );
}
