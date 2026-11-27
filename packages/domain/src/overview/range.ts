import { formatZonedDateTime, parseZonedDateTime } from "../zoned-time";

/**
 * فترة «نظرة عامة» (ADMIN_REDESIGN §5.1): اليوم أو 7 أو 30 أو 90 يومًا حتى اليوم، أو مدى مخصص بيومين.
 * الأيام بتقويم النادي (`Asia/Riyadh`)، والحالة كلها في الرابط (`?range=30d` أو `?from=&to=`).
 * الفترة السابقة بالطول نفسه قبلها مباشرة، وحين تنتهي الحالية الآن (اليوم جزء منها) تُقص السابقة
 * إلى الطول المنقضي نفسه، فالمقارنة عادلة (أول ساعتين من اليوم مقابل أول ساعتين من أمس).
 */
export const RANGE_PRESETS = ["today", "7d", "30d", "90d"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];
export const DEFAULT_RANGE: RangePreset = "30d";
/** أطول مدى مخصص بالأيام. */
export const MAX_RANGE_DAYS = 366;

const PRESET_DAYS: Readonly<Record<RangePreset, number>> = {
  today: 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

export interface Window {
  /** أول يوم وآخر يوم بتقويم النادي (‎YYYY-MM-DD‎). */
  readonly from: string;
  readonly to: string;
  /** بداية الفترة ونهايتها (غير مشمولة) لحظتين. */
  readonly start: Date;
  readonly end: Date;
}

export interface DateRange extends Window {
  readonly preset: RangePreset | "custom";
  readonly days: number;
  readonly previous: Window;
}

/** لماذا رُفض المدى المكتوب (فعُرض الافتراضي)، أو null. */
export type RangeIssue = "invalid" | "reversed" | "too_long" | "future";

export interface ParsedRange {
  readonly range: DateRange;
  readonly issue: RangeIssue | null;
}

export interface RangeInput {
  readonly range?: string | undefined;
  readonly from?: string | undefined;
  readonly to?: string | undefined;
}

const DAY_SHAPE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;
const DATE_LENGTH = 10;

function dayNumber(day: string): number | null {
  if (!DAY_SHAPE.test(day)) {
    return null;
  }
  const value = Date.parse(`${day}T00:00:00Z`);
  return Number.isNaN(value) || new Date(value).toISOString().slice(0, DATE_LENGTH) !== day
    ? null
    : value / MS_PER_DAY;
}

function dayString(number: number): string {
  return new Date(number * MS_PER_DAY).toISOString().slice(0, DATE_LENGTH);
}

/** بداية يوم النادي لحظةً. اليوم مضمون الشكل هنا، ومنتصف الليل موجود في كل منطقة بلا توقيت صيفي. */
function dayStart(day: string, timeZone: string): Date {
  const parsed = parseZonedDateTime(`${day}T00:00`, timeZone);
  return parsed.ok ? parsed.value : new Date(`${day}T00:00:00Z`);
}

/** اليوم الحالي بتقويم النادي. */
export function clubToday(now: Date, timeZone: string): string {
  return formatZonedDateTime(now, timeZone).slice(0, DATE_LENGTH);
}

function build(
  preset: DateRange["preset"],
  first: number,
  last: number,
  now: Date,
  timeZone: string,
): DateRange {
  const days = last - first + 1;
  const start = dayStart(dayString(first), timeZone);
  const end = new Date(Math.min(dayStart(dayString(last + 1), timeZone).getTime(), now.getTime()));
  const previousStart = dayStart(dayString(first - days), timeZone);
  const previousEnd = new Date(previousStart.getTime() + (end.getTime() - start.getTime()));
  return {
    preset,
    days,
    from: dayString(first),
    to: dayString(last),
    start,
    end,
    previous: {
      from: dayString(first - days),
      to: dayString(first - 1),
      start: previousStart,
      end: previousEnd,
    },
  };
}

function presetRange(preset: RangePreset, now: Date, timeZone: string): DateRange {
  const today = dayNumber(clubToday(now, timeZone)) ?? 0;
  return build(preset, today - PRESET_DAYS[preset] + 1, today, now, timeZone);
}

function customIssue(first: number | null, last: number | null, today: number): RangeIssue | null {
  if (first === null || last === null) {
    return "invalid";
  }
  if (first > last) {
    return "reversed";
  }
  if (last > today) {
    return "future";
  }
  return last - first + 1 > MAX_RANGE_DAYS ? "too_long" : null;
}

/**
 * الفترة من معاملات الرابط. مدى مخصص (`from` و`to` معًا) يُقدَّم على المقطع؛ والمرفوض منه يعرض
 * الافتراضي مع سبب الرفض، فلا تنكسر الصفحة برابط معدَّل يدويًا.
 */
export function parseRange(input: RangeInput, now: Date, timeZone: string): ParsedRange {
  if (input.from !== undefined || input.to !== undefined) {
    return customRange(input, now, timeZone);
  }
  const preset = RANGE_PRESETS.find((candidate) => candidate === input.range);
  return {
    range: presetRange(preset ?? DEFAULT_RANGE, now, timeZone),
    issue: input.range !== undefined && preset === undefined ? "invalid" : null,
  };
}

function customRange(input: RangeInput, now: Date, timeZone: string): ParsedRange {
  const today = dayNumber(clubToday(now, timeZone)) ?? 0;
  const first = dayNumber(input.from ?? "");
  const last = dayNumber(input.to ?? "");
  const issue = customIssue(first, last, today);
  if (issue === null && first !== null && last !== null) {
    return { range: build("custom", first, last, now, timeZone), issue: null };
  }
  return { range: presetRange(DEFAULT_RANGE, now, timeZone), issue };
}

/** أيام الفترة بالترتيب، الأقدم أولًا. */
export function rangeDays(window: Pick<Window, "from" | "to">): string[] {
  const first = dayNumber(window.from) ?? 0;
  const last = dayNumber(window.to) ?? first - 1;
  return Array.from({ length: Math.max(0, last - first + 1) }, (_, index) =>
    dayString(first + index),
  );
}
