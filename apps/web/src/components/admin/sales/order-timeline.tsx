import type { AdminDictionary } from "@/i18n/admin";
import { formatDateTime } from "@/i18n/admin/format";
import { fill } from "@/i18n/fill";
import type { TimelineEvent } from "@/server/admin/sales/timeline";
import { Card, Timeline } from "../ui/kit";
import styles from "./sales.module.css";

interface OrderTimelineProps {
  readonly events: readonly TimelineEvent[];
  readonly text: AdminDictionary["sales"]["orders"]["timeline"];
  readonly timezone: string;
}

/** الخط الزمني للطلب من سجل التدقيق، الأقدم أولًا، وكل حدث بفاعله. */
export function OrderTimeline({ events, text, timezone }: OrderTimelineProps) {
  return (
    <Card title={text.title}>
      {events.length === 0 ? (
        <p className={styles.note}>{text.empty}</p>
      ) : (
        <div data-testid="order-timeline">
          <Timeline
            entries={events.map((event) => ({
              id: event.id,
              title: event.title,
              meta: (
                <>
                  <time dateTime={event.at.toISOString()}>
                    {formatDateTime(event.at, timezone)}
                  </time>
                  {" · "}
                  {fill(text.by, { actor: event.actor })}
                </>
              ),
              lines: event.lines,
            }))}
          />
        </div>
      )}
    </Card>
  );
}
