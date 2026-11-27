import type { Money, PlainDate } from "@masar/domain";
import { moneyParts } from "../format";
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

/** تاريخ تقويمي بلا وقت (عمود DATE): «15 يونيو 2026». لا منطقة زمنية تزيحه. */
export function formatPlainDay(date: PlainDate, locale: AdminLocale = "ar"): string {
  const instant = new Date(Date.UTC(date.year, date.month - 1, date.day));
  return new Intl.DateTimeFormat(DATE_LOCALES[locale], {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(instant);
}

/** مبلغ بوحدته في جملة: «1,499 ر.س». للعرض داخل جدول استعمل `moneyParts` مع ‎<bdi>‎. */
export function formatAmount(value: Money, locale: AdminLocale = "ar"): string {
  const { amount, unit } = moneyParts(value, locale);
  return `${amount} ${unit}`;
}

const RELATIVE_LOCALES: Readonly<Record<AdminLocale, string>> = { ar: "ar-u-nu-latn" };

/** مدة مضت بالساعات بصيغة اللغة وجمعها: «قبل 40 ساعة»، «قبل ساعتين». */
export function formatHoursAgo(hours: number, locale: AdminLocale = "ar"): string {
  return new Intl.RelativeTimeFormat(RELATIVE_LOCALES[locale], { numeric: "auto" }).format(
    -hours,
    "hour",
  );
}
