import type { Locale } from "@/i18n/locales";
import type { ArticleTranslation, Block } from "./types";

/**
 * سرعة القراءة الصامتة المتوسطة للبالغين بالكلمة في الدقيقة، من دراسة IReST
 * (Trauzettel-Klosinski & Dietz, 2012): العربية 138 والإنجليزية 228. تقدير للقارئ لا وعد.
 */
const WORDS_PER_MINUTE: Readonly<Record<Locale, number>> = { ar: 138, en: 228 };

function blockText(block: Block): string[] {
  switch (block.type) {
    case "paragraph":
      return block.segments.map((segment) => segment.text);
    case "list":
    case "steps":
      return [...block.items];
    case "table":
      return [block.caption, ...block.head, ...block.rows.flat()];
    case "note":
      return [block.title, block.text];
    case "recommendation":
      return [];
  }
}

export function countWords(text: string): number {
  return text.split(/\s+/u).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

/** كل النص الذي يقرؤه الزائر في جسم المقال: الخلاصة والنقاط والأقسام. */
function articleText(translation: ArticleTranslation): string {
  return [
    translation.summary ?? "",
    ...translation.keyTakeaways,
    ...translation.sections.flatMap((section) => [
      section.heading,
      ...section.blocks.flatMap(blockText),
    ]),
  ].join(" ");
}

/** دقائق القراءة التقريبية، مقرَّبة للأعلى ودقيقة واحدة على الأقل. تُحسب على الخادم. */
export function readingMinutes(translation: ArticleTranslation, locale: Locale): number {
  const words = countWords(articleText(translation));
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE[locale]));
}
