import { DomainError } from "./errors";
import { err, ok, type Result } from "./result";

/** وقت محلي كما يكتبه حقل `datetime-local`: ‏`YYYY-MM-DDTHH:mm`. */
const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const PART_WIDTH = 2;
const YEAR_WIDTH = 4;

function zoneFormat(timeZone: string): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (cause) {
    throw new DomainError("invariant", "date.invalid_time_zone", { cause });
  }
}

/** اللحظة كما تُقرأ على ساعة المنطقة، بصيغة حقل `datetime-local`. */
export function formatZonedDateTime(instant: Date, timeZone: string): string {
  const parts = zoneFormat(timeZone).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes, width: number): string =>
    (parts.find((part) => part.type === type)?.value ?? "").padStart(width, "0");
  const date = `${value("year", YEAR_WIDTH)}-${value("month", PART_WIDTH)}-${value("day", PART_WIDTH)}`;
  return `${date}T${value("hour", PART_WIDTH)}:${value("minute", PART_WIDTH)}`;
}

/** فرق ساعة المنطقة عن UTC عند لحظة، بالمللي ثانية. */
function zoneOffsetMs(instantMs: number, timeZone: string): number {
  const wall = LOCAL_DATE_TIME.exec(formatZonedDateTime(new Date(instantMs), timeZone));
  const [year, month, day, hour, minute] = (wall?.slice(1) ?? []).map(Number);
  const asUtc = Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0);
  const wholeMinute = instantMs - (instantMs % MS_PER_MINUTE);
  return asUtc - wholeMinute;
}

const MS_PER_MINUTE = 60_000;

/**
 * وقت محلي بمنطقة النادي ← لحظة. يُرفض ما ليس بصيغته، وما لا يوجد على ساعة المنطقة (فجوة التوقيت
 * الصيفي): الوقت المكتوب يجب أن يُقرأ كما كُتب.
 */
export function parseZonedDateTime(input: string, timeZone: string): Result<Date, DomainError> {
  const match = LOCAL_DATE_TIME.exec(input.trim());
  if (match === null) {
    return err(new DomainError("validation", "date_time.invalid_format"));
  }
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const wallAsUtc = Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0);
  const firstGuess = wallAsUtc - zoneOffsetMs(wallAsUtc, timeZone);
  const instant = new Date(wallAsUtc - zoneOffsetMs(firstGuess, timeZone));
  if (formatZonedDateTime(instant, timeZone) !== match[0]) {
    return err(new DomainError("validation", "date_time.invalid"));
  }
  return ok(instant);
}
