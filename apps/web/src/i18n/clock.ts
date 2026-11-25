/** لاحقتا الصباح والمساء من القاموس («ص»/«م»، “AM”/“PM”). */
export interface ClockLabels {
  readonly am: string;
  readonly pm: string;
}

const HOURS_PER_HALF_DAY = 12;
const LAST_HOUR = 23;
const LAST_MINUTE = 59;
const MINUTE_DIGITS = 2;

/**
 * وقت بصيغة 24 ساعة («13:00») بنظام 12 ساعة كما يكتبه موقع النادي: «1:00 م»، ومنتصف الليل «12:00 ص».
 * الأرقام لاتينية في اللغتين (القرار 15).
 */
function inRange(value: number, max: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= max;
}

export function formatClock(time: string, labels: ClockLabels): string {
  const [hourText = "", minuteText = ""] = time.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!inRange(hour, LAST_HOUR) || !inRange(minute, LAST_MINUTE)) {
    throw new RangeError(`Invalid clock time: ${time}`);
  }
  const halfDayHour =
    hour % HOURS_PER_HALF_DAY === 0 ? HOURS_PER_HALF_DAY : hour % HOURS_PER_HALF_DAY;
  const suffix = hour < HOURS_PER_HALF_DAY ? labels.am : labels.pm;
  return `${String(halfDayHour)}:${String(minute).padStart(MINUTE_DIGITS, "0")} ${suffix}`;
}
