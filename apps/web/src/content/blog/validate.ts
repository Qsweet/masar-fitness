import { articlePath } from "@/config/routes";
import { LOCALES, type Locale } from "@/i18n/locales";
import { articleSchema, isInternalHref } from "./schema";
import type { Article, ArticleTranslation, Block, Reviewer } from "./types";

export interface ValidationContext {
  readonly reviewers: readonly Reviewer[];
  /** مسارات الموقع الثابتة التي يجوز ربطها من مقال */
  readonly staticPaths: readonly string[];
}

/** معرّفات مستعملة في صفحة المقال نفسها: قسم بالاسم نفسه يكسر المرساة. */
const RESERVED_IDS = new Set(["main", "top", "summary", "toc", "sources", "related"]);
const SUMMARY_MIN_SENTENCES = 2;
const SUMMARY_MAX_SENTENCES = 3;
/** نهاية جملة: نقطة أو علامة استفهام أو تعجب يتبعها فراغ أو نهاية النص (فلا يُعد ‎2.5‎ نهاية). */
const SENTENCE_END = /[.!?؟](?=\s|$)/u;

type Problems = string[];

function translationsOf(article: Article): [Locale, ArticleTranslation][] {
  return LOCALES.flatMap((locale) => {
    const translation = article.translations[locale];
    return translation === undefined ? [] : [[locale, translation] as [Locale, ArticleTranslation]];
  });
}

export function countSentences(text: string): number {
  return text
    .split(SENTENCE_END)
    .map((part) => part.trim())
    .filter((part) => part.length > 0).length;
}

function linksOf(block: Block): string[] {
  return block.type === "paragraph"
    ? block.segments.flatMap((segment) => (segment.type === "link" ? [segment.href] : []))
    : [];
}

/** المسار بلا استعلام ولا مرساة: ‎/memberships#compare‎ ← ‎/memberships‎ */
function bareRoute(href: string): string {
  return href.split(/[?#]/u)[0] ?? href;
}

function checkInternalLink(
  href: string,
  where: string,
  source: { article: Article; locale: Locale },
  all: readonly Article[],
  context: ValidationContext,
): string | undefined {
  const route = bareRoute(href);
  if (context.staticPaths.includes(route)) {
    return undefined;
  }
  const target = all.find((candidate) => articlePath(candidate.slug) === route);
  if (target === undefined) {
    return `${where}: internal link ${href} does not resolve to a site route`;
  }
  if (target.translations[source.locale] === undefined) {
    return `${where}: linked article ${target.slug} has no ${source.locale} translation`;
  }
  if (source.article.status === "published" && target.status !== "published") {
    return `${where}: published article links to unpublished ${target.slug}`;
  }
  return undefined;
}

function checkSections(
  article: Article,
  locale: Locale,
  translation: ArticleTranslation,
  all: readonly Article[],
  context: ValidationContext,
): Problems {
  const problems: Problems = [];
  const seen = new Set<string>();
  let recommendations = 0;
  for (const section of translation.sections) {
    const where = `${article.slug} [${locale}] #${section.id}`;
    if (seen.has(section.id)) {
      problems.push(`${where}: duplicate section id`);
    }
    if (RESERVED_IDS.has(section.id)) {
      problems.push(`${where}: section id is reserved by the page`);
    }
    seen.add(section.id);
    for (const block of section.blocks) {
      recommendations += block.type === "recommendation" ? 1 : 0;
      problems.push(...checkTable(block, where));
      for (const href of linksOf(block).filter(isInternalHref)) {
        const problem = checkInternalLink(href, where, { article, locale }, all, context);
        problems.push(...(problem === undefined ? [] : [problem]));
      }
    }
  }
  if (recommendations > 1) {
    problems.push(`${article.slug} [${locale}]: at most one in-text recommendation`);
  }
  return problems;
}

function checkTable(block: Block, where: string): Problems {
  if (block.type !== "table") {
    return [];
  }
  return block.rows.some((row) => row.length !== block.head.length)
    ? [
        `${where}: table "${block.caption ?? block.head.join(" | ")}" has rows that do not match its header`,
      ]
    : [];
}

function checkDates(article: Article): Problems {
  const problems: Problems = [];
  if (article.publishedAt !== undefined && article.updatedAt < article.publishedAt) {
    problems.push(`${article.slug}: updatedAt is before publishedAt`);
  }
  return problems;
}

/** بوابة النشر: ما يلزم المقال المنشور فوق الشكل الصحيح. */
function checkPublishGate(article: Article, context: ValidationContext): Problems {
  if (article.status !== "published") {
    return [];
  }
  const problems: Problems = [];
  const fail = (reason: string) => problems.push(`${article.slug}: published but ${reason}`);
  if (article.publishedAt === undefined) {
    fail("has no publishedAt");
  }
  if (article.reviewedAt === undefined) {
    fail("has no reviewedAt");
  }
  if (!context.reviewers.some((reviewer) => reviewer.id === article.reviewerId)) {
    fail("its reviewer is not in the reviewers registry");
  }
  for (const [locale, translation] of translationsOf(article)) {
    problems.push(...checkPublishedTranslation(article.slug, locale, translation));
  }
  return problems;
}

function checkPublishedTranslation(
  slug: string,
  locale: Locale,
  translation: ArticleTranslation,
): Problems {
  const where = `${slug} [${locale}]: published but`;
  const problems: Problems = [];
  const sentences = countSentences(translation.summary ?? "");
  if (translation.summary === undefined) {
    problems.push(`${where} has no summary`);
  } else if (sentences < SUMMARY_MIN_SENTENCES || sentences > SUMMARY_MAX_SENTENCES) {
    problems.push(`${where} the summary has ${String(sentences)} sentences (needs 2–3)`);
  }
  if (translation.keyTakeaways.length === 0) {
    problems.push(`${where} has no key takeaways`);
  }
  if (translation.sources.length === 0) {
    problems.push(`${where} has no sources`);
  }
  return problems;
}

function checkUniqueSlugs(articles: readonly Article[]): Problems {
  const seen = new Set<string>();
  const problems: Problems = [];
  for (const { slug } of articles) {
    if (seen.has(slug)) {
      problems.push(`${slug}: duplicate slug`);
    }
    seen.add(slug);
  }
  return problems;
}

function checkShape(article: Article): Problems {
  const result = articleSchema.safeParse(article);
  return result.success
    ? []
    : result.error.issues.map(
        (issue) => `${article.slug}: ${issue.path.join(".")}: ${issue.message}`,
      );
}

/** كل مشكلات قائمة المقالات: الشكل، وتفرد المعرّفات، والروابط الداخلية، والتواريخ، وبوابة النشر. */
export function articleProblems(
  articles: readonly Article[],
  context: ValidationContext,
): string[] {
  return [
    ...checkUniqueSlugs(articles),
    ...articles.flatMap((article) => {
      const shape = checkShape(article);
      if (shape.length > 0) {
        return shape;
      }
      return [
        ...checkDates(article),
        ...checkPublishGate(article, context),
        ...translationsOf(article).flatMap(([locale, translation]) =>
          checkSections(article, locale, translation, articles, context),
        ),
      ];
    }),
  ];
}

export class InvalidArticlesError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`Invalid blog articles:\n- ${problems.join("\n- ")}`);
    this.name = "InvalidArticlesError";
  }
}

/** يرمي عند أول قائمة فيها مشكلة: مقال خاطئ يُسقط الاختبارات والبناء، ولا يُخفى بصمت. */
export function assertValidArticles(
  articles: readonly Article[],
  context: ValidationContext,
): readonly Article[] {
  const problems = articleProblems(articles, context);
  if (problems.length > 0) {
    throw new InvalidArticlesError(problems);
  }
  return articles;
}
