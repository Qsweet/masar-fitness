import { err, ok, type Result } from "../../result";
import { parseZonedDateTime } from "../../zoned-time";

/**
 * حالة الشريحة لحظة `now` (ADMIN_A3_SLIDER §4): المخفية أولًا، ثم المجدولة قبل بدايتها، ثم المنتهية
 * من نهايتها. البداية شاملة والنهاية غير شاملة. الموقع يعرض `live` وحدها.
 */
export const SLIDE_STATUSES = ["live", "scheduled", "expired", "hidden"] as const;
export type SlideStatus = (typeof SLIDE_STATUSES)[number];

export interface SlideSchedule {
  readonly active: boolean;
  readonly startsAt: Date | null;
  readonly endsAt: Date | null;
}

export function slideStatus(slide: SlideSchedule, now: Date): SlideStatus {
  if (!slide.active) {
    return "hidden";
  }
  if (slide.startsAt !== null && slide.startsAt.getTime() > now.getTime()) {
    return "scheduled";
  }
  if (slide.endsAt !== null && slide.endsAt.getTime() <= now.getTime()) {
    return "expired";
  }
  return "live";
}

/** الشرائح السارية بترتيبها. */
export function liveSlides<T extends SlideSchedule>(slides: readonly T[], now: Date): T[] {
  return slides.filter((slide) => slideStatus(slide, now) === "live");
}

export interface ScheduleIssue {
  readonly field: "startsAt" | "endsAt";
  readonly reason: string;
}

function parseOptional(
  raw: string,
  timeZone: string,
  field: ScheduleIssue["field"],
): Result<Date | null, ScheduleIssue> {
  if (raw.trim() === "") {
    return ok(null);
  }
  const parsed = parseZonedDateTime(raw, timeZone);
  return parsed.ok ? ok(parsed.value) : err({ field, reason: "slider.schedule_invalid" });
}

/** حقلا الجدولة (‎YYYY-MM-DDTHH:mm‎ بمنطقة النادي، أو فارغ) ← لحظتان؛ النهاية بعد البداية. */
export function parseSchedule(
  input: { readonly startsAt: string; readonly endsAt: string },
  timeZone: string,
): Result<{ readonly startsAt: Date | null; readonly endsAt: Date | null }, ScheduleIssue> {
  const startsAt = parseOptional(input.startsAt, timeZone, "startsAt");
  if (!startsAt.ok) {
    return startsAt;
  }
  const endsAt = parseOptional(input.endsAt, timeZone, "endsAt");
  if (!endsAt.ok) {
    return endsAt;
  }
  const start = startsAt.value;
  const end = endsAt.value;
  if (start !== null && end !== null && end.getTime() <= start.getTime()) {
    return err({ field: "endsAt", reason: "slider.schedule_order" });
  }
  return ok({ startsAt: start, endsAt: end });
}
