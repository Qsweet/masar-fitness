/** لغات المحتوى العام. المجال بلا اعتماد على الويب، فالقائمة هنا تطابق `LOCALES` فيه (يفحصه اختبار). */
export const CONTENT_LOCALES = ["ar", "en"] as const;
export type ContentLocale = (typeof CONTENT_LOCALES)[number];

export function isContentLocale(value: string): value is ContentLocale {
  return CONTENT_LOCALES.some((locale) => locale === value);
}
