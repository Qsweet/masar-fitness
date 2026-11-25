import { CLUB_HOURS, type HoursArea, type OpeningSlot } from "@/config/hours";
import { formatClock } from "@/i18n/clock";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/fill";

/** صف ساعات جاهز للعرض: «السبت – الخميس» و«6:00 ص – 2:00 ص». */
export interface HoursRow {
  readonly days: string;
  readonly opens: string;
  readonly closes: string;
  readonly range: string;
}

function toRow(slot: OpeningSlot, dictionary: Dictionary): HoursRow {
  const { hours } = dictionary;
  const opens = formatClock(slot.opens, hours);
  const closes = formatClock(slot.closes, hours);
  return {
    days: hours.days[slot.days],
    opens,
    closes,
    range: fill(hours.range, { opens, closes }),
  };
}

/** ساعات النادي أو المسبح من config/hours.ts بصيغة القاموس. */
export function hoursRows(area: HoursArea, dictionary: Dictionary): HoursRow[] {
  return CLUB_HOURS[area].map((slot) => toRow(slot, dictionary));
}

/** الأيام العادية (السبت – الخميس) للنادي: أول صف في الجدول. */
export function weekdayHours(dictionary: Dictionary): HoursRow {
  const [first] = hoursRows("club", dictionary);
  if (first === undefined) {
    throw new Error("CLUB_HOURS.club is empty");
  }
  return first;
}
