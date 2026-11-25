/** قراءات محاولات الدفع: تحديد المحاولة من مرجع المزوّد، وقوائم مهمة المطابقة، وملخص صفحة الطلب. */
import type { AttemptStatus } from "@masar/domain";
import type { Db } from "../client";
import { Prisma } from "../generated/prisma/client";
import { toAttemptRecord, type PaymentAttemptRecord } from "./records";

export async function findAttemptById(
  db: Db,
  attemptId: string,
): Promise<PaymentAttemptRecord | undefined> {
  const row = await db.paymentAttempt.findUnique({ where: { id: attemptId } });
  return row === null ? undefined : toAttemptRecord(row);
}

/** المحاولة صاحبة جلسة المزوّد هذه. مرجع للتحديد فقط: الحالة تُقرأ من المزوّد بعدها. */
export async function findAttemptBySession(
  db: Db,
  provider: string,
  providerSessionId: string,
): Promise<PaymentAttemptRecord | undefined> {
  const row = await db.paymentAttempt.findFirst({ where: { provider, providerSessionId } });
  return row === null ? undefined : toAttemptRecord(row);
}

export async function findAttemptByPayment(
  db: Db,
  provider: string,
  providerPaymentId: string,
): Promise<PaymentAttemptRecord | undefined> {
  const row = await db.paymentAttempt.findFirst({ where: { provider, providerPaymentId } });
  return row === null ? undefined : toAttemptRecord(row);
}

/** أحدث محاولة للطلب (صفحة العودة تتحقق منها). */
export async function findLatestAttemptForOrder(
  db: Db,
  orderId: string,
): Promise<PaymentAttemptRecord | undefined> {
  const row = await db.paymentAttempt.findFirst({
    where: { orderId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  return row === null ? undefined : toAttemptRecord(row);
}

export interface OrderPaymentSummary {
  readonly liveAttempt: { readonly status: AttemptStatus; readonly deadlineAt: Date } | null;
  /** آخر محاولة انتهت بلا مال (فشل أو انتهاء جلسة)، لتنبيه العميل قبل إعادة المحاولة. */
  readonly lastAttemptFailed: boolean;
  readonly hasOpenIncident: boolean;
}

const UNPAID_ENDINGS: readonly AttemptStatus[] = ["failed", "expired"];

/** ما تحتاجه صفحة الطلب من محاولاته وحوادثه. */
export async function getOrderPaymentSummary(
  db: Db,
  orderId: string,
): Promise<OrderPaymentSummary> {
  const [latest, live, incidents] = await Promise.all([
    findLatestAttemptForOrder(db, orderId),
    db.$queryRaw<{ status: AttemptStatus; deadline_at: Date }[]>`
      SELECT a.status, a.deadline_at FROM payment_attempts a
      WHERE a.order_id = ${orderId}::uuid AND payment_attempt_is_live(a.status, a.settled_at)
      ORDER BY a.created_at DESC LIMIT 1`,
    db.paymentIncident.count({ where: { orderId, resolvedAt: null } }),
  ]);
  const liveRow = live[0];
  return {
    liveAttempt:
      liveRow === undefined ? null : { status: liveRow.status, deadlineAt: liveRow.deadline_at },
    lastAttemptFailed: latest !== undefined && UNPAID_ENDINGS.includes(latest.status),
    hasOpenIncident: incidents > 0,
  };
}

async function recordsByIds(db: Db, ids: readonly string[]): Promise<PaymentAttemptRecord[]> {
  if (ids.length === 0) {
    return [];
  }
  const rows = await db.paymentAttempt.findMany({
    where: { id: { in: [...ids] } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return rows.map(toAttemptRecord);
}

async function selectAttempts(db: Db, where: Prisma.Sql, limit: number) {
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT a.id::text AS id FROM payment_attempts a WHERE ${where}
    ORDER BY a.last_checked_at NULLS FIRST, a.created_at, a.id LIMIT ${limit}`;
  return recordsByIds(
    db,
    rows.map((row) => row.id),
  );
}

export interface AttemptListOptions {
  readonly provider: string;
  readonly limit: number;
}

/** المحاولات الحيّة ذات الجلسة التي لم تُفحص منذ `checkedBefore`: مرشّحة للمطابقة. */
export function listLiveAttemptsForSync(
  db: Db,
  options: AttemptListOptions & { readonly checkedBefore: Date },
): Promise<PaymentAttemptRecord[]> {
  const where = Prisma.sql`a.provider = ${options.provider} AND a.provider_session_id IS NOT NULL
    AND payment_attempt_is_live(a.status, a.settled_at)
    AND (a.last_checked_at IS NULL OR a.last_checked_at <= ${options.checkedBefore})`;
  return selectAttempts(db, where, options.limit);
}

/** محاولات بقيت `created` منذ ما قبل `createdBefore`: توقفت العملية قبل أن تُكتب نتيجة المزوّد. */
export function listStaleCreatedAttempts(
  db: Db,
  options: AttemptListOptions & { readonly createdBefore: Date },
): Promise<PaymentAttemptRecord[]> {
  const where = Prisma.sql`a.provider = ${options.provider} AND a.status = 'created'
    AND a.created_at <= ${options.createdBefore}`;
  return selectAttempts(db, where, options.limit);
}

/** محاولات فشل بدؤها بلا معرّف جلسة منذ `endedAfter`: قد تكون للمزوّد جلسة يتيمة تُلغى. */
export function listFailedStarts(
  db: Db,
  options: AttemptListOptions & { readonly endedAfter: Date },
): Promise<PaymentAttemptRecord[]> {
  const where = Prisma.sql`a.provider = ${options.provider} AND a.status = 'failed'
    AND a.provider_session_id IS NULL AND a.ended_at >= ${options.endedAfter}
    AND a.failure_reason IN ('provider_unreachable', 'start_interrupted')`;
  return selectAttempts(db, where, options.limit);
}

/** محاولات محصَّلة سُوّيت منذ `settledAfter` ولم تُفحص منذ `checkedBefore`: يُكشف بها العكس اللاحق. */
export function listSettledForRecheck(
  db: Db,
  options: AttemptListOptions & { readonly settledAfter: Date; readonly checkedBefore: Date },
): Promise<PaymentAttemptRecord[]> {
  const where = Prisma.sql`a.provider = ${options.provider} AND a.status = 'captured'
    AND a.settled_at >= ${options.settledAfter}
    AND (a.last_checked_at IS NULL OR a.last_checked_at <= ${options.checkedBefore})`;
  return selectAttempts(db, where, options.limit);
}
