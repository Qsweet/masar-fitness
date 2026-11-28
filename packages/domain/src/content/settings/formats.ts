import { toAsciiDigits } from "../../digits";
import { parseSaudiMobile } from "../../saudi-mobile";
import { isInternalPathShape, parseExternalUrl } from "../slider/link";
import type { TextFormat, TextSpec } from "./spec";

/**
 * صيغ الحقول النصية: كل صيغة تطبّع القيمة أو ترفضها (null). الفحص بأنماط لا بمنصة (المجال بلا منصة).
 */
const SAUDI_PHONE = /^\+966\d{8,9}$/;
const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;
const DIGITS = /^\d+$/;
const INT = /^(?:0|[1-9]\d*)$/;
const YEAR = /^(?:19|20)\d{2}$/;
const DECIMAL = /^-?\d{1,3}(?:\.\d{1,7})?$/;
const RATING = /^[1-5]\.\d$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const PLUS_CODE = /^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}$/;
const MAX_RATING = 5;

function matching(pattern: RegExp): (value: string) => string | null {
  return (value) => (pattern.test(value) ? value : null);
}

/** يوم تقويمي حقيقي (لا 2026-02-30). */
export function isCalendarDate(value: string): boolean {
  const match = DATE.exec(value);
  if (match === null) {
    return false;
  }
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
  return date.toISOString().startsWith(value);
}

function phone(value: string): string | null {
  const compact = toAsciiDigits(value).replace(/[\s\-.()]/g, "");
  return SAUDI_PHONE.test(compact) ? compact : null;
}

function mobile(value: string): string | null {
  const parsed = parseSaudiMobile(value);
  return parsed.ok ? parsed.value : null;
}

function rating(value: string): string | null {
  return RATING.test(value) && Number(value) <= MAX_RATING ? value : null;
}

const SIMPLE: Readonly<Record<Exclude<TextFormat, "url">, (value: string) => string | null>> = {
  plain: (value) => value,
  phone,
  mobile,
  email: matching(EMAIL),
  digits: (value) => matching(DIGITS)(toAsciiDigits(value)),
  int: (value) => matching(INT)(toAsciiDigits(value)),
  year: (value) => matching(YEAR)(toAsciiDigits(value)),
  decimal: matching(DECIMAL),
  rating,
  date: (value) => (isCalendarDate(value) ? value : null),
  time: matching(TIME),
  plusCode: (value) => matching(PLUS_CODE)(value.toUpperCase()),
  path: (value) => (isInternalPathShape(value) ? value : null),
};

function hostedUrl(value: string, hosts: readonly string[]): string | null {
  const parsed = parseExternalUrl(value);
  if (!parsed.ok) {
    return null;
  }
  const host = parsed.value.slice("https://".length).split(/[/?#]/)[0] ?? "";
  return hosts.includes(host) ? parsed.value : null;
}

/** القيمة مطبَّعة بصيغة الحقل، أو null إن خالفتها. الفارغ يُفحص خارجها. */
export function normalizeText(spec: TextSpec, value: string): string | null {
  return spec.format === "url" ? hostedUrl(value, spec.hosts) : SIMPLE[spec.format](value);
}

const SAUDI_PREFIX = "+966";
const AREA_END = 2;
const BLOCK_END = 5;

/** الهاتف كما يُعرض محليًا: ‎+966163240111‎ ← «016 324 0111»، والجوال ‎+9665…‎ ← «055 324 0111». */
export function displaySaudiPhone(e164: string): string {
  const national = e164.startsWith(SAUDI_PREFIX) ? e164.slice(SAUDI_PREFIX.length) : e164;
  return `0${national.slice(0, AREA_END)} ${national.slice(AREA_END, BLOCK_END)} ${national.slice(BLOCK_END)}`;
}

const DAY_MS = 86_400_000;

/** عدد الأيام بين يومين تقويميين (شاملًا اليومين)، أو null لغير تاريخ. */
export function daySpan(from: string, to: string): number | null {
  if (!isCalendarDate(from) || !isCalendarDate(to)) {
    return null;
  }
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;
}
