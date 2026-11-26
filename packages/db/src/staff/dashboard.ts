/**
 * قراءات «نظرة عامة» في اللوحة: كلها من القاعدة وبتقويم منطقة النادي الزمنية، و`now` يُمرَّر فالاختبار
 * يثبّت الوقت. لا جوال كاملًا يخرج من هنا: آخر أربعة أرقام فقط.
 */
import { effectiveOrderStatus, type OrderStatus } from "@masar/domain";
import type { Db } from "../client";
import type { ClubSummary } from "./overview";

export interface DailyOrders {
  /** اليوم بتقويم النادي: ‎YYYY-MM-DD‎. */
  readonly day: string;
  /** طلبات أُنشئت في اليوم. */
  readonly created: number;
  /** طلبات دُفعت في اليوم (بوقت الدفع لا الإنشاء). */
  readonly paid: number;
  /** مجموع ما دُفع في اليوم بالهللة. */
  readonly revenueMinor: number;
}

/**
 * سلسلة يومية لآخر `days` يومًا حتى اليوم (الأقدم أولًا)، وكل يوم حاضر ولو بلا طلبات. اليوم الحالي
 * حتى `now` فقط.
 */
export async function dailyOrderSeries(
  db: Db,
  club: ClubSummary,
  now: Date,
  days: number,
): Promise<DailyOrders[]> {
  const tz = club.timezone;
  return db.$queryRaw<DailyOrders[]>`
    WITH days AS (
      SELECT generate_series(
        date_trunc('day', ${now}::timestamptz AT TIME ZONE ${tz}) - make_interval(days => ${days - 1}::int),
        date_trunc('day', ${now}::timestamptz AT TIME ZONE ${tz}),
        interval '1 day') AS day
    ), bounds AS (
      SELECT day, day AT TIME ZONE ${tz} AS starts, (day + interval '1 day') AT TIME ZONE ${tz} AS ends
      FROM days
    )
    SELECT to_char(b.day, 'YYYY-MM-DD') AS day,
      (SELECT count(*)::int FROM orders o
        WHERE o.club_id = ${club.id}::uuid AND o.created_at >= b.starts AND o.created_at < b.ends
          AND o.created_at <= ${now}::timestamptz) AS created,
      (SELECT count(*)::int FROM orders o
        WHERE o.club_id = ${club.id}::uuid AND o.paid_at >= b.starts AND o.paid_at < b.ends
          AND o.paid_at <= ${now}::timestamptz) AS paid,
      (SELECT coalesce(sum(o.paid_amount_minor), 0)::int FROM orders o
        WHERE o.club_id = ${club.id}::uuid AND o.paid_at >= b.starts AND o.paid_at < b.ends
          AND o.paid_at <= ${now}::timestamptz) AS "revenueMinor"
    FROM bounds b ORDER BY b.day`;
}

/** الطلبات المعلّقة التي لم تبلغ مهلتها: ما ينتظر الدفع الآن فعلًا. */
export function countAwaitingPayment(db: Db, clubId: string, now: Date): Promise<number> {
  return db.order.count({
    where: { clubId, status: "pending_payment", expiresAt: { gt: now } },
  });
}

export interface RecentOrder {
  readonly id: string;
  readonly reference: string;
  /** آخر أربعة أرقام من جوال العميل، للتعرّف لا للاتصال. */
  readonly phoneLast4: string;
  readonly itemNameAr: string;
  readonly itemNameEn: string;
  readonly totalMinor: number;
  readonly currency: string;
  /** الحالة كما تُعرض: المعلّق الذي بلغ مهلته منتهٍ. */
  readonly status: OrderStatus;
  readonly createdAt: Date;
}

const PHONE_TAIL = 4;

export async function listRecentOrders(
  db: Db,
  clubId: string,
  now: Date,
  limit: number,
): Promise<RecentOrder[]> {
  const rows = await db.order.findMany({
    where: { clubId, createdAt: { lte: now } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    include: { items: { where: { position: 0 }, select: { nameAr: true, nameEn: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    reference: row.reference,
    phoneLast4: row.customerPhoneE164.slice(-PHONE_TAIL),
    itemNameAr: row.items[0]?.nameAr ?? "",
    itemNameEn: row.items[0]?.nameEn ?? "",
    totalMinor: row.totalMinor,
    currency: row.currency,
    status: effectiveOrderStatus(row.status, row.expiresAt, now),
    createdAt: row.createdAt,
  }));
}

export interface MfaCoverage {
  readonly active: number;
  readonly enrolled: number;
}

/** كم من الحسابات النشطة فعّل التحقق بخطوتين. */
export async function staffMfaCoverage(db: Db, clubId: string): Promise<MfaCoverage> {
  const where = { clubId, status: "active" } as const;
  const [active, enrolled] = await Promise.all([
    db.staffUser.count({ where }),
    db.staffUser.count({ where: { ...where, totpEnabledAt: { not: null } } }),
  ]);
  return { active, enrolled };
}
