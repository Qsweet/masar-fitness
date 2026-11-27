import "server-only";
import {
  clubHasOrders,
  countAwaitingPayment,
  periodDailySeries,
  periodFunnel,
  periodSalesByPlan,
  type ClubSummary,
  type PlanSales,
} from "@masar/db";
import { orderFunnel, topShares, type DateRange, type Funnel, type Share } from "@masar/domain";
import { getDb } from "../../db";
import { periodSummary, type PeriodSummary } from "./summary";

/** أكبر الاشتراكات في «المبيعات حسب الاشتراك»، وما بعدها «غيرها» (خمس فئات على الأكثر، §3.1). */
const TOP_PLANS = 4;

/** قراءات الفترة كلها بالتوازي؛ كل بطاقة تنتظر ما يخصها فقط (Suspense). */
export function loadSummary(club: ClubSummary, range: DateRange): Promise<PeriodSummary> {
  const db = getDb();
  return Promise.all([
    periodDailySeries(db, club.id, club.timezone, range),
    periodDailySeries(db, club.id, club.timezone, range.previous),
  ]).then(([current, previous]) => periodSummary(current, previous));
}

export interface PlanSalesView {
  readonly shares: readonly Share<PlanSales>[];
  readonly totalMinor: number;
  readonly orders: number;
}

export async function loadPlanSales(club: ClubSummary, range: DateRange): Promise<PlanSalesView> {
  const rows = await periodSalesByPlan(getDb(), club.id, range);
  return {
    shares: topShares(
      rows.map((row) => ({ item: row, amount: row.revenueMinor, count: row.orders })),
      TOP_PLANS,
    ),
    totalMinor: rows.reduce((total, row) => total + row.revenueMinor, 0),
    orders: rows.reduce((total, row) => total + row.orders, 0),
  };
}

export async function loadFunnel(club: ClubSummary, range: DateRange): Promise<Funnel> {
  return orderFunnel(await periodFunnel(getDb(), club.id, range));
}

export function loadAwaiting(club: ClubSummary, now: Date): Promise<number> {
  return countAwaitingPayment(getDb(), club.id, now);
}

export function loadHasOrders(club: ClubSummary): Promise<boolean> {
  return clubHasOrders(getDb(), club.id);
}
