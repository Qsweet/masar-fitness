/**
 * عدّادات تبويبات الطلبات (ADMIN_REDESIGN §6.1): عدد كل تبويب في المدى نفسه باستعلام واحد (`COUNT(*)
 * FILTER`)، بشروط `tabFilter` في list-orders.ts نفسها (المعلّق الذي بلغ مهلته منتهٍ). اختبار التكامل
 * يطابق كل عدد بمجموع قائمته.
 */
import type { Db } from "../client";
import {
  dayBounds,
  listOrdersWithin,
  ORDER_LIST_TABS,
  type OrderDayBounds,
  type OrderListPage,
  type OrderListQuery,
  type OrderListTab,
} from "./list-orders";

export type OrderTabCounts = Readonly<Record<OrderListTab, number>>;

export type OrderCountQuery = Pick<OrderListQuery, "clubId" | "from" | "to" | "now">;

type CountRow = Record<OrderListTab, number>;

async function countWithin(
  db: Db,
  query: OrderCountQuery,
  { starts, ends }: OrderDayBounds,
): Promise<OrderTabCounts> {
  const rows = await db.$queryRaw<CountRow[]>`
    SELECT count(*)::int AS "all",
      count(*) FILTER (WHERE status = 'pending_payment' AND expires_at > ${query.now})::int
        AS awaiting,
      count(*) FILTER (WHERE status IN ('paid', 'fulfilled'))::int AS paid,
      count(*) FILTER (WHERE status = 'expired'
        OR (status = 'pending_payment' AND expires_at <= ${query.now}))::int AS expired,
      count(*) FILTER (WHERE status = 'cancelled')::int AS cancelled
    FROM orders
    WHERE club_id = ${query.clubId}::uuid
      AND (${starts}::timestamptz IS NULL OR created_at >= ${starts}::timestamptz)
      AND (${ends}::timestamptz IS NULL OR created_at < ${ends}::timestamptz)`;
  const row = rows[0];
  return Object.fromEntries(ORDER_LIST_TABS.map((tab) => [tab, row?.[tab] ?? 0])) as CountRow;
}

export async function countOrdersByTab(db: Db, query: OrderCountQuery): Promise<OrderTabCounts> {
  return countWithin(db, query, await dayBounds(db, query));
}

/** صفحة القائمة وعدّادات تبويباتها بحدّي مدى محسوبين مرة واحدة. */
export async function listOrdersWithCounts(
  db: Db,
  query: OrderListQuery,
): Promise<{ readonly page: OrderListPage; readonly counts: OrderTabCounts }> {
  const bounds = await dayBounds(db, query);
  const [page, counts] = await Promise.all([
    listOrdersWithin(db, query, bounds),
    countWithin(db, query, bounds),
  ]);
  return { page, counts };
}
