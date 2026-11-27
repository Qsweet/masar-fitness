/**
 * أنواع نصوص المحتوى وحدود أطوالها (ADMIN_A3_CONTENT §3.3). ثوابت تقنية لا قرار عمل: تمنع نصًا يكسر
 * التخطيط، والطول يُعدّ بنقاط الترميز بعد التطبيع (حرف عربي واحد بتشكيله المركّب لا يُعدّ حرفين).
 */
export const TEXT_KINDS = [
  "label",
  "short",
  "line",
  "paragraph",
  "metaTitle",
  "metaDescription",
] as const;
export type TextKind = (typeof TEXT_KINDS)[number];

export const TEXT_LIMITS: Readonly<Record<TextKind, number>> = {
  label: 40,
  short: 90,
  line: 240,
  paragraph: 700,
  metaTitle: 70,
  metaDescription: 200,
};

/** المدى الذي تعرضه نتائج البحث كاملًا: خارجه تنبيه لا رفض. */
export interface AdvisoryRange {
  readonly min: number;
  readonly max: number;
}

export const TEXT_ADVISORY: Readonly<Partial<Record<TextKind, AdvisoryRange>>> = {
  metaTitle: { min: 30, max: 60 },
  metaDescription: { min: 70, max: 160 },
};

export function textLength(text: string): number {
  return Array.from(text.normalize("NFC")).length;
}

/**
 * نوع النص من مساره وقيمته الافتراضية: العنوان والوصف لمحركات البحث باسم المفتاح، وما سواهما بطول
 * الأطول من الافتراضيين، فيبقى للمحرر ضعف الطول الأصلي على الأقل. العتبات نصف الحد التالي.
 */
const KIND_BY_LENGTH: readonly (readonly [maxDefault: number, kind: TextKind])[] = [
  [TEXT_LIMITS.label / 2, "label"],
  [TEXT_LIMITS.short / 2, "short"],
  [TEXT_LIMITS.line / 2, "line"],
];

export function textKindOf(path: string, defaults: readonly string[]): TextKind {
  const last = path.split(".").at(-1) ?? "";
  const isMeta = path.startsWith("meta.") || last.startsWith("meta");
  if (isMeta && last.endsWith("Title")) {
    return "metaTitle";
  }
  if (isMeta && last.endsWith("Description")) {
    return "metaDescription";
  }
  const longest = Math.max(...defaults.map(textLength));
  return KIND_BY_LENGTH.find(([maxDefault]) => longest <= maxDefault)?.[1] ?? "paragraph";
}
