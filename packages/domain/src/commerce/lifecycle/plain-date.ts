import { DomainError } from "../../errors";
import { err, ok, type Result } from "../../result";

/** تاريخ تقويمي بلا وقت ولا منطقة، مثل عمود DATE في PostgreSQL. الشهر من 1 إلى 12. */
export interface PlainDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

const MIN_YEAR = 1;
const MAX_YEAR = 9999;
const MONTHS_PER_YEAR = 12;
const YEAR_DIGITS = 4;
const PART_DIGITS = 2;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** آخر يوم في الشهر عبر تقويم UTC؛ `setUTCFullYear` يعامل السنوات الصغيرة حرفيًا. */
function daysInMonth(year: number, month: number): number {
  const date = new Date(0);
  date.setUTCFullYear(year, month, 0);
  return date.getUTCDate();
}

function isValidPlainDate(year: number, month: number, day: number): boolean {
  return (
    Number.isSafeInteger(year) &&
    Number.isSafeInteger(month) &&
    Number.isSafeInteger(day) &&
    year >= MIN_YEAR &&
    year <= MAX_YEAR &&
    month >= 1 &&
    month <= MONTHS_PER_YEAR &&
    day >= 1 &&
    day <= daysInMonth(year, month)
  );
}

/** يبني تاريخًا صحيحًا أو يرمي invariant؛ للقيم الصادرة من الكود لا من العميل. */
export function plainDate(year: number, month: number, day: number): PlainDate {
  if (!isValidPlainDate(year, month, day)) {
    throw new DomainError("invariant", "date.invalid");
  }
  return Object.freeze({ year, month, day });
}

function partsToDate(parts: readonly Intl.DateTimeFormatPart[]): PlainDate {
  const value = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value);
  return plainDate(value("year"), value("month"), value("day"));
}

/** التاريخ التقويمي للحظة في منطقة زمنية (منطقة النادي من `clubs.timezone`). */
export function plainDateInZone(instant: Date, timeZone: string): PlainDate {
  if (Number.isNaN(instant.getTime())) {
    throw new DomainError("invariant", "date.invalid_instant");
  }
  let format: Intl.DateTimeFormat;
  try {
    format = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch (cause) {
    throw new DomainError("invariant", "date.invalid_time_zone", { cause });
  }
  return partsToDate(format.formatToParts(instant));
}

/**
 * أشهر ميلادية مع قصّ آخر الشهر، مطابق لـ`date + interval 'N months'` في PostgreSQL:
 * 31 يناير + شهر = آخر فبراير.
 */
export function addMonthsClamped(date: PlainDate, months: number): PlainDate {
  if (!Number.isSafeInteger(months)) {
    throw new DomainError("invariant", "date.invalid_months");
  }
  const monthIndex = date.year * MONTHS_PER_YEAR + (date.month - 1) + months;
  const year = Math.floor(monthIndex / MONTHS_PER_YEAR);
  const month = monthIndex - year * MONTHS_PER_YEAR + 1;
  return plainDate(year, month, Math.min(date.day, daysInMonth(year, month)));
}

export function addDays(date: PlainDate, days: number): PlainDate {
  if (!Number.isSafeInteger(days)) {
    throw new DomainError("invariant", "date.invalid_days");
  }
  const shifted = new Date(0);
  shifted.setUTCFullYear(date.year, date.month - 1, date.day + days);
  return plainDate(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

/** سالب إن كان `a` قبل `b`، وصفر عند التساوي، وموجب إن كان بعده. */
export function comparePlainDates(a: PlainDate, b: PlainDate): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

/** صيغة ISO ‏`YYYY-MM-DD` كما يقرؤها عمود DATE. */
export function formatPlainDate(date: PlainDate): string {
  const pad = (value: number, width: number): string => String(value).padStart(width, "0");
  return `${pad(date.year, YEAR_DIGITS)}-${pad(date.month, PART_DIGITS)}-${pad(date.day, PART_DIGITS)}`;
}

export function parsePlainDate(input: string): Result<PlainDate, DomainError> {
  const match = ISO_DATE.exec(input);
  const [year, month, day] = (match?.slice(1) ?? []).map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    return err(new DomainError("validation", "date.invalid_format"));
  }
  if (!isValidPlainDate(year, month, day)) {
    return err(new DomainError("validation", "date.invalid"));
  }
  return ok(plainDate(year, month, day));
}
