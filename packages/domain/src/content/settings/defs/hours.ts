import type { SettingIssue } from "../check";
import { daySpan } from "../formats";
import { bool, fieldPath, group, list, localized, text, type ShapeValue } from "../spec";

/**
 * أوقات العمل (ADMIN_A3_CONTENT §5.2، WP7): المعتاد للنادي والمسبح كلٌّ على حدة، وفترات خاصة (رمضان،
 * العيد) بمدى تاريخ. الإغلاق قبل الافتتاح يعني بعد منتصف الليل. قائمة الفترات تبدأ فارغة: لا وقت
 * يُخترع.
 */
const TIME_MAX = 5;
const DATE_MAX = 10;
const NAME_MAX = 40;
/** رمضان مع العيد في فترة واحدة يتجاوز 60 يومًا (القرار 96). */
export const SPECIAL_PERIOD_MAX_DAYS = 100;
export const SPECIAL_PERIODS_MAX = 12;

const SLOT = { opens: text("time", TIME_MAX, true), closes: text("time", TIME_MAX, true) };
const AREA = { satThu: group(SLOT), fri: group(SLOT) };

export const HOURS_SHAPE = {
  gym: group(AREA),
  pool: group(AREA),
  specials: list(
    {
      name: localized(NAME_MAX, "both"),
      from: text("date", DATE_MAX, true),
      to: text("date", DATE_MAX, true),
      /** النادي مغلق طوال الفترة (يوم العيد): أوقاتها لا تُعرض. */
      closed: bool(),
      gym: group(AREA),
      pool: group(AREA),
    },
    SPECIAL_PERIODS_MAX,
  ),
};
export type HoursSetting = ShapeValue<typeof HOURS_SHAPE>;
export type AreaHours = HoursSetting["gym"];
export type DaySlot = AreaHours["satThu"];
export type SpecialPeriod = HoursSetting["specials"][number];
export const DAY_GROUPS = ["satThu", "fri"] as const;
export type DayGroup = (typeof DAY_GROUPS)[number];

function periodIssue(period: SpecialPeriod): string | null {
  const span = daySpan(period.from, period.to);
  if (span === null) {
    return null;
  }
  if (span < 1) {
    return "settings.range_order";
  }
  return span > SPECIAL_PERIOD_MAX_DAYS ? "settings.period_too_long" : null;
}

export function checkHours(value: HoursSetting): SettingIssue[] {
  const issues: SettingIssue[] = [];
  value.specials.forEach((period, index) => {
    const path = fieldPath("specials", index);
    const reason = periodIssue(period);
    if (reason !== null) {
      issues.push({ field: fieldPath(path, "to"), reason });
    }
    const overlaps = value.specials.some(
      (other, at) => at < index && other.from <= period.to && period.from <= other.to,
    );
    if (overlaps) {
      issues.push({ field: fieldPath(path, "from"), reason: "settings.period_overlap" });
    }
  });
  return issues;
}

export interface ActiveHours {
  readonly gym: AreaHours;
  readonly pool: AreaHours;
  /** الفترة الخاصة السارية اليوم، أو null للمعتاد. */
  readonly special: SpecialPeriod | null;
}

/** الأوقات السارية في يوم بتقويم النادي (`YYYY-MM-DD`). */
export function activeHours(hours: HoursSetting, today: string): ActiveHours {
  const special = hours.specials.find((period) => period.from <= today && today <= period.to);
  return special === undefined
    ? { gym: hours.gym, pool: hours.pool, special: null }
    : { gym: special.gym, pool: special.pool, special };
}

/** الفترات التي لم تنتهِ بعد، بترتيب بدايتها (للبيانات المنظَّمة). */
export function upcomingPeriods(hours: HoursSetting, today: string): SpecialPeriod[] {
  return hours.specials
    .filter((period) => period.to >= today)
    .sort((a, b) => (a.from < b.from ? -1 : 1));
}
