import { LOCALES, type Locale } from "@/i18n/locales";
import type { Article, ArticleTranslation, Block } from "./blog/types";

/**
 * تدقيق النصوص الآلي: علامات الترقيم والمسافات والأرقام والاقتباس، لكل نص في القاموسين والمقالات.
 * القواعد والاستثناءات موثقة في docs/BLOG.md. الاستثناء يُعلَن هنا صراحةً (لا تعطيل لقاعدة).
 */
export interface CopyIssue {
  readonly rule: string;
  readonly excerpt: string;
}

export interface CopyViolation extends CopyIssue {
  /** مسار المفتاح في القاموس، أو «المعرّف [اللغة] الموضع» في المقال */
  readonly where: string;
}

/** حرف عربي (لا علامات الترقيم ولا التطويل ولا الأرقام). */
const AR = "\\u0621-\\u063A\\u0641-\\u064A\\u066E-\\u06D3\\u06FA-\\u06FF";
const LATIN = "A-Za-z";
const CONTEXT_CHARS = 12;
/** بديل الأجزاء المحمية: محرف من المنطقة الخاصة لا يطابقه أي قاعدة، وبالطول نفسه حتى يبقى موضع المقتطف صحيحًا. */
const MASK = "\uE000";

/**
 * الاستثناءات الصريحة: أجزاء تُحجب قبل الفحص لأن شكلها صحيح وإن خالف قاعدة عامة.
 * - الروابط: فيها نقاط وشرطات وأحرف لاتينية ملاصقة.
 * - العناصر النائبة في قوالب القاموس ({plan}، {amount}).
 * - الاختصارات العربية بالنقطة: «ر.س» (ريال سعودي) نقطة بين حرفين عربيين بلا مسافة.
 */
const PROTECTED: readonly RegExp[] = [/https?:\/\/[^\s«»“”"]+/gu, /\{\w+\}/gu, /ر\.س/gu];

interface PatternRule {
  readonly id: string;
  readonly pattern: RegExp;
}

const SHARED_RULES: readonly PatternRule[] = [
  { id: "double-space", pattern: / {2,}/gu },
  { id: "edge-space", pattern: /^\s+|\s+$/gu },
];

const ARABIC_RULES: readonly PatternRule[] = [
  ...SHARED_RULES,
  // فاصلة أو فاصلة منقوطة أو استفهام لاتينية بعد كلمة عربية وقبل عربية أو نهاية النص
  {
    id: "latin-punctuation",
    pattern: new RegExp(
      `[${AR}][^${LATIN}${AR}]*?(?<![0-9])[,;?](?=[^${LATIN}]*?([${AR}]|$))`,
      "gu",
    ),
  },
  { id: "space-before-punctuation", pattern: /\s+[،؛؟.,!:;?)\]»]/gu },
  { id: "missing-space-after", pattern: new RegExp(`[،؛؟][^\\s»)\\]”]|[.!:][${AR}]`, "gu") },
  { id: "tatweel", pattern: /\u0640/gu },
  { id: "arabic-indic-digits", pattern: /[\u0660-\u0669\u06F0-\u06F9]/gu },
  { id: "latin-touching-arabic", pattern: new RegExp(`[${LATIN}][${AR}]|[${AR}][${LATIN}]`, "gu") },
  { id: "ascii-ellipsis", pattern: /\.{3}/gu },
];

const ENGLISH_RULES: readonly PatternRule[] = [
  ...SHARED_RULES,
  { id: "space-before-punctuation", pattern: /\s+[.,;:!?)\]]/gu },
];

type Pairs = readonly (readonly [string, string])[];
const BRACKETS: Pairs = [
  ["(", ")"],
  ["[", "]"],
];
const ARABIC_PAIRS: Pairs = [...BRACKETS, ["«", "»"]];
const ENGLISH_PAIRS: Pairs = [...BRACKETS, ["“", "”"]];

function mask(text: string): string {
  return PROTECTED.reduce(
    (current, pattern) => current.replace(pattern, (m) => MASK.repeat(m.length)),
    text,
  );
}

function excerpt(text: string, index: number, length: number): string {
  const start = Math.max(0, index - CONTEXT_CHARS);
  return text.slice(start, index + length + CONTEXT_CHARS);
}

function patternIssues(
  original: string,
  masked: string,
  rules: readonly PatternRule[],
): CopyIssue[] {
  return rules.flatMap(({ id, pattern }) =>
    [...masked.matchAll(pattern)].map((match) => ({
      rule: id,
      excerpt: excerpt(original, match.index, match[0].length),
    })),
  );
}

/** أقواس وعلامات اقتباس متوازنة ومتداخلة تداخلًا صحيحًا. */
function balanceIssue(original: string, masked: string, pairs: Pairs): CopyIssue | undefined {
  const closers = new Map(pairs.map(([open, close]) => [close, open]));
  const openers = new Set(pairs.map(([open]) => open));
  const stack: string[] = [];
  for (const char of masked) {
    if (openers.has(char)) {
      stack.push(char);
    } else if (closers.has(char) && stack.pop() !== closers.get(char)) {
      return { rule: "unbalanced-pair", excerpt: original };
    }
  }
  return stack.length > 0 ? { rule: "unbalanced-pair", excerpt: original } : undefined;
}

/** الاقتباس الإنجليزي من نوع واحد في النص الواحد: مستقيم أو منحنٍ، للمزدوج وللمفرد كلٌّ على حدة. */
function quoteStyleIssues(original: string, masked: string): CopyIssue[] {
  const mixedDouble = masked.includes('"') && /[“”]/u.test(masked);
  const mixedSingle = masked.includes("'") && /[‘’]/u.test(masked);
  const unevenStraight = (masked.match(/"/gu)?.length ?? 0) % 2 !== 0;
  return mixedDouble || mixedSingle || unevenStraight
    ? [{ rule: "inconsistent-quotes", excerpt: original }]
    : [];
}

/** مشكلات نص واحد حسب لغته. */
export function lintText(text: string, locale: Locale): CopyIssue[] {
  const masked = mask(text);
  if (locale === "ar") {
    const balance = balanceIssue(text, masked, ARABIC_PAIRS);
    return [...patternIssues(text, masked, ARABIC_RULES), ...(balance ? [balance] : [])];
  }
  const balance = balanceIssue(text, masked, ENGLISH_PAIRS);
  return [
    ...patternIssues(text, masked, ENGLISH_RULES),
    ...quoteStyleIssues(text, masked),
    ...(balance ? [balance] : []),
  ];
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
      return [block.caption, ...block.head, ...block.rows.flat().filter((cell) => cell !== "")];
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
