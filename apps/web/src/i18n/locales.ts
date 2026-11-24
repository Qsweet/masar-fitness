export const LOCALES = ["ar", "en"] as const;
export type Locale = (typeof LOCALES)[number];

/** العربية هي اللغة الأساسية وتُخدَّم بلا بادئة في الرابط. */
export const DEFAULT_LOCALE: Locale = "ar";

const DIRECTIONS: Record<Locale, "rtl" | "ltr"> = { ar: "rtl", en: "ltr" };

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export function directionOf(locale: Locale): "rtl" | "ltr" {
  return DIRECTIONS[locale];
}

/** الرابط العام لمسار داخل لغة: العربية بلا بادئة، وغيرها ببادئة اللغة. */
export function localizedPath(locale: Locale, path = "/"): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (locale === DEFAULT_LOCALE) {
    return normalized;
  }
  return normalized === "/" ? `/${locale}` : `/${locale}${normalized}`;
}
