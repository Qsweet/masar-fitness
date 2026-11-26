/** أرقام «نظرة عامة» من القاعدة فقط: طلبات اليوم (بتقويم منطقة النادي) بحالاتها. */
import { ORDER_STATUSES, type OrderStatus } from "@masar/domain";
import type { Db } from "../client";

export type OrderCounts = Readonly<Record<OrderStatus, number>>;

export interface ClubSummary {
  readonly id: string;
  readonly nameAr: string;
  readonly nameEn: string;
  readonly timezone: string;
  readonly currency: string;
}

export async function findClubSummary(db: Db, clubId: string): Promise<ClubSummary | null> {
  return db.club.findUnique({
    where: { id: clubId },
    select: { id: true, nameAr: true, nameEn: true, timezone: true, currency: true },
  });
}

/** النوادي كلها بأقدمها أولًا: أمر إنشاء المالك يختار منها، وتدقيق دخول بلا حساب يُنسب لأولها. */
export async function listClubs(db: Db): Promise<(ClubSummary & { slug: string })[]> {
  return db.club.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, slug: true, nameAr: true, nameEn: true, timezone: true, currency: true },
  });
}

/**
 * عدد الطلبات المنشأة منذ بداية اليوم في منطقة النادي الزمنية، لكل حالة مخزَّنة. بداية اليوم تحسبها
 * القاعدة من `now` الممرَّر، فالاختبار يثبّت الوقت.
 */
export async function countOrdersToday(db: Db, club: ClubSummary, now: Date): Promise<OrderCounts> {
  const rows = await db.$queryRaw<{ status: OrderStatus; total: number }[]>`
    SELECT status::text AS status, count(*)::int AS total
    FROM orders
    WHERE club_id = ${club.id}::uuid
      AND created_at >= date_trunc('day', ${now}::timestamptz AT TIME ZONE ${club.timezone}) AT TIME ZONE ${club.timezone}
      AND created_at <= ${now}::timestamptz
    GROUP BY status`;
  const totals = new Map(rows.map((row) => [row.status, row.total]));
  const entries = ORDER_STATUSES.map((status) => [status, totals.get(status) ?? 0] as const);
  return Object.fromEntries(entries) as OrderCounts;
}
