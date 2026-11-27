/**
 * طابور الإرسال وسجله (ADMIN_A5_TRACKING §4.1–4.2). المرسِل يحجز دفعة بـ`SKIP LOCKED` ومهلة حجز،
 * فمرسِلان متزامنان لا يأخذان السطر نفسه، وما توقف مرسِله يعود بعد المهلة. لا جسم رد ولا حمولة هنا.
 */
import { isServerProvider, isTrackingProvider, type ServerProvider } from "@masar/domain";
import type { Db } from "../client";

export const OUTBOX_STATUSES = ["pending", "sent", "dead", "skipped"] as const;
export type OutboxStatus = (typeof OUTBOX_STATUSES)[number];

/** مهلة الحجز: إن توقف المرسِل يعود السطر للطابور بعدها. */
const CLAIM_LEASE_MS = 300_000;

export interface ClaimedEvent {
  readonly id: string;
  readonly clubId: string;
  readonly orderId: string;
  readonly provider: ServerProvider;
  readonly eventName: string;
  readonly eventId: string;
  readonly attempts: number;
  readonly eventTime: Date;
}

interface ClaimRow {
  readonly id: string;
  readonly club_id: string;
  readonly order_id: string;
  readonly provider: string;
  readonly event_name: string;
  readonly event_id: string;
  readonly attempts: number;
  readonly event_time: Date;
}

function claimed(row: ClaimRow): ClaimedEvent | null {
  if (!isTrackingProvider(row.provider) || !isServerProvider(row.provider)) {
    return null;
  }
  return {
    id: row.id,
    clubId: row.club_id,
    orderId: row.order_id,
    provider: row.provider,
    eventName: row.event_name,
    eventId: row.event_id,
    attempts: row.attempts,
    eventTime: row.event_time,
  };
}

/** يحجز حتى `limit` حدثًا حيًّا حان وقته، الأقدم أولًا. */
export async function claimDueEvents(db: Db, now: Date, limit: number): Promise<ClaimedEvent[]> {
  const lease = new Date(now.getTime() + CLAIM_LEASE_MS);
  const rows = await db.$queryRaw<ClaimRow[]>`
    UPDATE tracking_outbox SET next_attempt_at = ${lease}, updated_at = ${now}
    WHERE id IN (
      SELECT id FROM tracking_outbox
      WHERE status = 'pending' AND kind = 'live' AND next_attempt_at <= ${now}
      ORDER BY next_attempt_at, id LIMIT ${limit} FOR UPDATE SKIP LOCKED)
    RETURNING id::text, club_id::text, order_id::text, provider, event_name, event_id, attempts,
      event_time`;
  return rows.map(claimed).filter((event): event is ClaimedEvent => event !== null);
}

export type AttemptResult =
  | { readonly kind: "sent"; readonly status: number | null }
  | {
      readonly kind: "retry";
      readonly at: Date;
      readonly status: number | null;
      readonly reason: string;
    }
  | { readonly kind: "dead"; readonly status: number | null; readonly reason: string }
  | { readonly kind: "skipped"; readonly reason: string };

/** يسجّل نتيجة المحاولة على سطر ما زال معلّقًا. `skipped` لا يُعدّ محاولة (لم يُرسل شيء). */
export async function recordAttempt(
  db: Db,
  id: string,
  result: AttemptResult,
  now: Date,
): Promise<void> {
  const status = result.kind === "retry" ? "pending" : result.kind;
  const httpStatus = result.kind === "skipped" ? null : result.status;
  const reason = result.kind === "sent" ? null : result.reason;
  const counted = result.kind === "skipped" ? 0 : 1;
  const next = result.kind === "retry" ? result.at : now;
  const sentAt = result.kind === "sent" ? now : null;
  await db.$executeRaw`
    UPDATE tracking_outbox SET status = ${status}, attempts = attempts + ${counted},
      next_attempt_at = ${next}, last_status = ${httpStatus}, last_reason = ${reason},
      sent_at = ${sentAt}, updated_at = ${now}
    WHERE id = ${id}::uuid AND status = 'pending'`;
}

export interface TestEventRecord {
  readonly clubId: string;
  readonly provider: ServerProvider;
  readonly eventName: string;
  readonly eventId: string;
  readonly delivered: boolean;
  readonly status: number | null;
  readonly reason: string | null;
  readonly now: Date;
}

/** حدث الاختبار من اللوحة: يُسجَّل بنتيجته مباشرةً، بلا طلب ولا إعادة. */
export async function recordTestEvent(db: Db, record: TestEventRecord): Promise<void> {
  const status = record.delivered ? "sent" : "dead";
  await db.$executeRaw`
    INSERT INTO tracking_outbox (id, club_id, order_id, provider, event_name, event_id, kind, status,
      attempts, next_attempt_at, last_status, last_reason, event_time, created_at, updated_at, sent_at)
    VALUES (gen_random_uuid(), ${record.clubId}::uuid, NULL, ${record.provider}, ${record.eventName},
      ${record.eventId}, 'test', ${status}, 1, ${record.now}, ${record.status}, ${record.reason},
      ${record.now}, ${record.now}, ${record.now}, ${record.delivered ? record.now : null})`;
}
