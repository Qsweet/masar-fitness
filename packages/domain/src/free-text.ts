/** محارف التحكم عدا السطر الجديد والجدولة، ومحارف التنسيق غير المرئية (ومنها علامات الاتجاه). */
const FREE_TEXT_FORBIDDEN = /[^\P{Cc}\n\t]|\p{Cf}/gu;

/**
 * نص حر كما يُحفظ: بلا NUL ولا محارف تحكم (PostgreSQL يرفض NUL في النص) ولا علامات اتجاه تقلب
 * عرضه، ومشذَّبًا. السطر الجديد والجدولة يبقيان. تستعملها ملاحظة الدفع اليدوي ونصوص المحتوى.
 */
export function sanitizeFreeText(text: string): string {
  return text.replace(FREE_TEXT_FORBIDDEN, "").trim();
}
