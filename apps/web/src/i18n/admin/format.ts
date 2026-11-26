import type { AdminLocale } from "./index";

/** تقويم ميلادي وأرقام لاتينية كما في الموقع العام (القرار 15). */
const DATE_LOCALES: Readonly<Record<AdminLocale, string>> = { ar: "ar-SA-u-ca-gregory-nu-latn" };

/** تاريخ ووقت بمنطقة النادي الزمنية: «26 نوفمبر 2026، 12:05 م». */
export function formatDateTime(date: Date, timeZone: string, locale: AdminLocale = "ar"): string {
  return new Intl.DateTimeFormat(DATE_LOCALES[locale], {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(date);
}

/** اليوم بمنطقة النادي الزمنية: «26 نوفمبر 2026». */
export function formatDay(date: Date, timeZone: string, locale: AdminLocale = "ar"): string {
  return new Intl.DateTimeFormat(DATE_LOCALES[locale], { dateStyle: "long", timeZone }).format(
    date,
  );
}
