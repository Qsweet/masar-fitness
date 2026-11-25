import type { Locale } from "./locales";

/**
 * تقويم ميلادي وأرقام لاتينية في اللغتين (القرار 15). ‎ar-SA‎ وحده يعني التقويم الهجري،
 * فالتقويم يُحدَّد صراحةً. التاريخ يوم تقويمي بلا وقت، فيُقرأ ويُكتب بتوقيت UTC حتى لا يزحف يومًا.
 */
const DATE_LOCALES: Readonly<Record<Locale, string>> = {
  ar: "ar-SA-u-ca-gregory-nu-latn",
  en: "en-GB-u-ca-gregory",
};

/** «25 نوفمبر 2026» / «25 November 2026» من ‎2026-11-25‎. */
export function formatDate(isoDate: string, locale: Locale): string {
  return new Intl.DateTimeFormat(DATE_LOCALES[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T00:00:00Z`));
}
