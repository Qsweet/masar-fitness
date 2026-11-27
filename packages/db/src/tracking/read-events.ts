/** سجل الإرسالات للوحة (ADMIN_A5_TRACKING §8): بلا حمولة ولا بيانات عميل؛ مرجع الطلب وحده. */
import type { Db } from "../client";

export interface TrackingEventRow {
  readonly id: string;
  readonly provider: string;
  readonly eventName: string;
  readonly kind: string;
  readonly status: string;
  readonly attempts: number;
  readonly lastStatus: number | null;
  readonly lastReason: string | null;
  readonly orderReference: string | null;
  readonly createdAt: Date;
  readonly sentAt: Date | null;
}

interface Row {
  readonly id: string;
  readonly provider: string;
  readonly event_name: string;
  readonly kind: string;
  readonly status: string;
  readonly attempts: number;
  readonly last_status: number | null;
  readonly last_reason: string | null;
  readonly reference: string | null;
  readonly created_at: Date;
  readonly sent_at: Date | null;
}

export async function listRecentTrackingEvents(
  db: Db,
  clubId: string,
  limit: number,
): Promise<TrackingEventRow[]> {
  const rows = await db.$queryRaw<Row[]>`
    SELECT t.id::text, t.provider, t.event_name, t.kind, t.status, t.attempts, t.last_status,
      t.last_reason, o.reference, t.created_at, t.sent_at
    FROM tracking_outbox t LEFT JOIN orders o ON o.id = t.order_id
    WHERE t.club_id = ${clubId}::uuid
    ORDER BY t.created_at DESC, t.id DESC LIMIT ${limit}`;
  return rows.map((row) => ({
    id: row.id,
    provider: row.provider,
    eventName: row.event_name,
    kind: row.kind,
    status: row.status,
    attempts: row.attempts,
    lastStatus: row.last_status,
    lastReason: row.last_reason,
    orderReference: row.reference,
    createdAt: row.created_at,
    sentAt: row.sent_at,
  }));
}
