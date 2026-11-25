import { CLUB_CONTACT, CLUB_POSTAL_ADDRESS } from "@/config/club";
import { getDictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/locales";
import type { Block, Segment, Source } from "../types";

/**
 * مختصرات لكتابة المقالات بيانات مقروءة. لا منطق فيها: كل ما تنتجه يمر بالمخطط وبوابة النشر
 * (schema.ts وvalidate.ts) كأي مقال مكتوب باليد.
 */

/** رابط داخل فقرة: مسار في الموقع بلا لغة، أو https خارجي. */
export function link(text: string, href: string): Segment {
  return { type: "link", text, href };
}

/** فقرة من نص وروابط متتالية. */
export function p(...parts: readonly (string | Segment)[]): Block {
  return {
    type: "paragraph",
    segments: parts.map((part) => (typeof part === "string" ? { type: "text", text: part } : part)),
  };
}

export function list(...items: readonly string[]): Block {
  return { type: "list", items };
}

/** قائمة مرقّمة: الترقيم في المسودة جزء من المعنى (خطوات أو أسئلة بترتيبها). */
export function steps(...items: readonly string[]): Block {
  return { type: "steps", items };
}

export function table(head: readonly string[], rows: readonly (readonly string[])[]): Block {
  return { type: "table", head, rows };
}

export function note(title: string, text: string): Block {
  return { type: "note", title, text };
}

/** موضع التوصية الحية داخل النص ([RECOMMENDATION: memberships] في المسودة). */
export const RECOMMENDATION: Block = { type: "recommendation", kind: "memberships" };

/**
 * حقائق النادي داخل نص المقال تُبنى من مصدرها الواحد (config/club.ts والقاموس) لا تُكتب باليد،
 * فلا ينحرف المقال عن العنوان أو الهاتف أو الاسم إن تغيّر أحدها.
 */
export function clubFacts(locale: Locale) {
  return {
    name: getDictionary(locale).club.name,
    city: CLUB_POSTAL_ADDRESS.locality[locale],
    address: CLUB_CONTACT.address[locale],
    phone: CLUB_CONTACT.phoneDisplay,
  } as const;
}

/** تاريخ فتح المراجع والتحقق منها في هذه المسودات. */
export const ACCESSED = "2026-11-25";

/** مرجع واحد للغتين: الناشر قد يُكتب بكل لغة (مثل «عبر PubMed Central»)، والعنوان كما نشره صاحبه. */
export interface SharedSource {
  readonly title: string;
  readonly publisher: string | Readonly<Record<Locale, string>>;
  readonly url: string;
  readonly year: number;
  /**
   * لغة المرجع (وسم BCP 47): تُعلَن على العنوان، وعلى الناشر إن كان نصًا واحدًا للغتين.
   * الناشر المكتوب بكل لغة هو بلغة الصفحة فلا يحتاجها.
   */
  readonly lang?: string;
}

/** قائمة المراجع بلغة واحدة، بالترتيب نفسه فتبقى أرقام الإحالة [1]… صحيحة في اللغتين. */
export function sourcesFor(locale: Locale, sources: readonly SharedSource[]): readonly Source[] {
  return sources.map(({ title, publisher, url, year, lang }) => {
    const shared = typeof publisher === "string";
    return {
      title,
      publisher: shared ? publisher : publisher[locale],
      url,
      year,
      accessed: ACCESSED,
      ...(lang === undefined ? {} : { lang }),
      ...(lang === undefined || !shared ? {} : { publisherLang: lang }),
    };
  });
}
