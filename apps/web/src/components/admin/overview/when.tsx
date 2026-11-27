import { formatDateTime } from "@/i18n/admin/format";
import { relativeTime } from "@/server/admin/overview-view";

export interface WhenProps {
  readonly at: Date;
  readonly now: Date;
  readonly timezone: string;
}

/** وقت نسبي قصير، والتاريخ الكامل بمنطقة النادي في التلميح وبعد أسبوع. */
export function When({ at, now, timezone }: WhenProps) {
  const full = formatDateTime(at, timezone);
  return (
    <time dateTime={at.toISOString()} title={full}>
      {relativeTime(at, now) ?? full}
    </time>
  );
}
