import type { Locale } from "@/i18n/locales";
import type { TopicId } from "./topics";

/** تاريخ تقويمي بصيغة ISO ‏(YYYY-MM-DD). */
export type IsoDate = string;

/** مقطع نص داخل فقرة: نص عادي أو رابط. الداخلي مسار في الموقع بلا لغة (‎/memberships‎)، والخارجي https فقط. */
export type Segment =
  | { readonly type: "text"; readonly text: string }
  | { readonly type: "link"; readonly text: string; readonly href: string };

export type Block =
  | { readonly type: "paragraph"; readonly segments: readonly Segment[] }
  | { readonly type: "list"; readonly items: readonly string[] }
  /** خطوات مرقّمة بترتيب التنفيذ */
  | { readonly type: "steps"; readonly items: readonly string[] }
  | {
      readonly type: "table";
      readonly caption: string;
      readonly head: readonly string[];
      readonly rows: readonly (readonly string[])[];
    }
  /** تنبيه بارز، مثل «متى تراجع مختصًا» */
  | { readonly type: "note"; readonly title: string; readonly text: string }
  /** توصية حية من الكتالوج (سعر من القاعدة، تختفي إن لم يُعرض شيء للبيع) */
  | { readonly type: "recommendation"; readonly kind: "memberships" };

export interface Section {
  /** معرّف المرساة في الرابط (‎#id‎): حروف لاتينية صغيرة وأرقام وشرطات */
  readonly id: string;
  /** العنوان سؤال، والجواب المباشر في أول فقرة بعده */
  readonly heading: string;
  readonly blocks: readonly Block[];
}

export interface Source {
  readonly title: string;
  readonly publisher: string;
  /** https فقط، وفتحه إنسان قبل النشر */
  readonly url: string;
  readonly year: number;
  /** تاريخ آخر فتح للرابط والتحقق منه */
  readonly accessed: IsoDate;
}

export interface ArticleTranslation {
  readonly title: string;
  /** وصف البحث والمشاركة: 155 حرفًا على الأكثر */
  readonly description: string;
  /** الجواب أولًا: جملتان أو ثلاث. إلزامي للنشر */
  readonly summary?: string;
  readonly keyTakeaways: readonly string[];
  readonly sections: readonly Section[];
  readonly sources: readonly Source[];
}

export type ArticleStatus = "draft" | "published";

export interface Article {
  /** معرّف الرابط: حروف لاتينية صغيرة وأرقام بشرطات، واحد لكل اللغات */
  readonly slug: string;
  readonly topic: TopicId;
  readonly status: ArticleStatus;
  /** إلزامي للمنشور. المسودة بلا تاريخ نشر */
  readonly publishedAt?: IsoDate;
  readonly updatedAt: IsoDate;
  readonly reviewedAt?: IsoDate;
  /** معرّف المراجع في reviewers.ts */
  readonly reviewerId?: string;
  readonly translations: Readonly<Partial<Record<Locale, ArticleTranslation>>>;
}

export interface Reviewer {
  readonly id: string;
  readonly name: Readonly<Record<Locale, string>>;
  /** الصفة: «مدرب شخصي معتمد»… */
  readonly role: Readonly<Record<Locale, string>>;
  /** الشهادة أو الترخيص كما تُكتب للقارئ */
  readonly credential: Readonly<Record<Locale, string>>;
}
