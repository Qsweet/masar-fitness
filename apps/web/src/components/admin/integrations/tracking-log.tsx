import type { TrackingEventRow } from "@masar/db";
import { Cell, DataTable } from "@/components/admin/ui/data-table";
import { Badge, EmptyState, Ltr, type Tone } from "@/components/admin/ui/kit";
import { lookup, type AdminDictionary } from "@/i18n/admin";
import { formatDateTime } from "@/i18n/admin/format";
import styles from "./integrations.module.css";

const TONES: Readonly<Record<string, Tone>> = {
  pending: "info",
  sent: "success",
  dead: "danger",
  skipped: "warning",
};

interface TrackingLogProps {
  readonly events: readonly TrackingEventRow[];
  readonly timezone: string;
  readonly dictionary: AdminDictionary;
}

function Response({
  event,
  text,
}: {
  readonly event: TrackingEventRow;
  readonly text: AdminDictionary["integrations"]["log"];
}) {
  return (
    <>
      {event.lastStatus === null ? null : <Ltr>{String(event.lastStatus)}</Ltr>}
      {event.lastReason === null ? null : (
        <span className={styles.reason}>
          {" "}
          {lookup(text.reasons, event.lastReason, event.lastReason)}
        </span>
      )}
    </>
  );
}

/** سجل الإرسالات (ADMIN_A5_TRACKING §8): بلا حمولة ولا بيانات عميل؛ مرجع الطلب وحده. */
export function TrackingLog({ events, timezone, dictionary }: TrackingLogProps) {
  const text = dictionary.integrations.log;
  const names = dictionary.audit.platforms;
  if (events.length === 0) {
    return <EmptyState icon="activity" title={text.emptyTitle} description={text.emptyLead} />;
  }
  const { columns } = text;
  return (
    <DataTable
      caption={text.title}
      columns={[
        columns.time,
        columns.provider,
        columns.event,
        columns.order,
        columns.status,
        columns.attempts,
        columns.response,
      ]}
      testId="tracking-log"
      compact
    >
      {events.map((event) => (
        <tr key={event.id}>
          <Cell label={columns.time} muted nowrap slot="meta">
            {formatDateTime(event.createdAt, timezone)}
          </Cell>
          <Cell label={columns.provider} strong slot="title">
            {lookup(names, event.provider, event.provider)}
          </Cell>
          <Cell label={columns.event} slot="aside">
            <Ltr>{event.eventName}</Ltr> · {lookup(text.kinds, event.kind, event.kind)}
          </Cell>
          <Cell label={columns.order}>
            {event.orderReference === null ? "—" : <Ltr>{event.orderReference}</Ltr>}
          </Cell>
          <Cell label={columns.status} slot="badge">
            <Badge tone={TONES[event.status] ?? "neutral"}>
              {lookup(text.statuses, event.status, event.status)}
            </Badge>
          </Cell>
          <Cell label={columns.attempts} align="numeric">
            {String(event.attempts)}
          </Cell>
          <Cell label={columns.response} slot="value">
            <Response event={event} text={text} />
          </Cell>
        </tr>
      ))}
    </DataTable>
  );
}
