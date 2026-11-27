import { lintText, type CopyIssue } from "@masar/domain";
import { LOCALES, type Locale } from "@/i18n/locales";
import type { Article, ArticleTranslation, Block } from "./blog/types";

/**
 * تدقيق شجرة القاموس والمقالات بقواعد `lintText` (في المجال منذ A3: يرفض بها الخادم حفظ نص محتوى).
 * القواعد والاستثناءات موثقة في docs/BLOG.md.
 */
export { lintText };
export type { CopyIssue };

export interface CopyViolation extends CopyIssue {
  /** مسار المفتاح في القاموس، أو «المعرّف [اللغة] الموضع» في المقال */
  readonly where: string;
}

/** كل نص في شجرة (قاموس أو جزء منه) مع مسار مفتاحه: ‎payment.methods[2].note‎. */
export function lintTree(value: unknown, locale: Locale, path = ""): CopyViolation[] {
  if (typeof value === "string") {
    return lintText(value, locale).map((issue) => ({ ...issue, where: path }));
  }
  if (Array.isArray(value)) {
    return value.flatMap((item: unknown, index) =>
      lintTree(item, locale, `${path}[${String(index)}]`),
    );
  }
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, item]) =>
      lintTree(item, locale, path === "" ? key : `${path}.${key}`),
    );
  }
  return [];
}

function blockStrings(block: Block): string[] {
  switch (block.type) {
    case "paragraph":
      // المقاطع تُقرأ متصلة: المسافة بين النص والرابط جزء من أحدهما
      return [block.segments.map((segment) => segment.text).join("")];
    case "list":
    case "steps":
      return [...block.items];
    case "table":
      return [
        ...(block.caption === undefined ? [] : [block.caption]),
        ...block.head,
        ...block.rows.flat().filter((cell) => cell !== ""),
      ];
    case "note":
      return [block.title, block.text];
    case "recommendation":
      return [];
  }
}

/** نصوص الترجمة الظاهرة مع موضع كل منها. الروابط نفسها (href) ليست نصًا ظاهرًا. */
function translationStrings(translation: ArticleTranslation): [string, string][] {
  return [
    ["title", translation.title],
    ["description", translation.description],
    ...(translation.summary === undefined
      ? []
      : [["summary", translation.summary] as [string, string]]),
    ...translation.keyTakeaways.map((item, index): [string, string] => [
      `keyTakeaways[${String(index)}]`,
      item,
    ]),
    ...translation.sections.flatMap((section) => [
      [`#${section.id} heading`, section.heading] as [string, string],
      ...section.blocks
        .flatMap(blockStrings)
        .map((text): [string, string] => [`#${section.id}`, text]),
    ]),
    ...translation.sources.flatMap((source, index): [string, string][] => [
      [`sources[${String(index)}].title`, source.title],
      [`sources[${String(index)}].publisher`, source.publisher],
    ]),
  ];
}

/** مشكلات نصوص مقال بكل لغاته: «المعرّف [اللغة] الموضع». */
export function lintArticle(article: Article): CopyViolation[] {
  return LOCALES.flatMap((locale) => {
    const translation = article.translations[locale];
    if (translation === undefined) {
      return [];
    }
    return translationStrings(translation).flatMap(([where, text]) =>
      lintText(text, locale).map((issue) => ({
        ...issue,
        where: `${article.slug} [${locale}] ${where}`,
      })),
    );
  });
}
