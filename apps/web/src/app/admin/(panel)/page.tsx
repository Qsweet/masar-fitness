import {
  countAwaitingPayment,
  dailyOrderSeries,
  listAuditLogs,
  listRecentOrders,
  listStaff,
  staffMfaCoverage,
  type ClubSummary,
} from "@masar/db";
import { hasPermission, type StaffRole } from "@masar/domain";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { KpiStrip } from "@/components/admin/overview/kpi-strip";
import { OrdersChart } from "@/components/admin/overview/orders-chart";
import {
  ActivityFeed,
  overviewStyles,
  RecentOrders,
  SystemCard,
} from "@/components/admin/overview/panels";
import { Card, PageHeader } from "@/components/admin/ui/kit";
import {
  ADMIN_ROUTES,
  OVERVIEW_ACTIVITY_ROWS,
  OVERVIEW_CHART_DAYS,
  OVERVIEW_RECENT_ORDERS,
  OVERVIEW_SPARK_DAYS,
} from "@/config/admin";
import { getAdminDictionary } from "@/i18n/admin";
import { formatDay } from "@/i18n/admin/format";
import { fill } from "@/i18n/fill";
import { cx } from "@/lib/cx";
import { staffClub } from "@/server/admin/club";
import { requireStaff } from "@/server/admin/guard";
import { activityItem, kpiOf } from "@/server/admin/overview-view";
import { systemStatus } from "@/server/admin/system-status";
import { getDb } from "@/server/db";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().overview.title };
}

const CHART_TITLE_ID = "orders-chart-title";

/** آخر النشاط لمن يقرأ سجل التدقيق فقط. */
async function loadActivity(club: ClubSummary, role: StaffRole) {
  if (!hasPermission(role, "audit.read")) {
    return null;
  }
  const db = getDb();
  const [log, members] = await Promise.all([
    listAuditLogs(db, { clubId: club.id, page: 1, pageSize: OVERVIEW_ACTIVITY_ROWS }),
    listStaff(db, club.id),
  ]);
  const names = new Map(members.map((member) => [member.id, member.displayName]));
  const dictionary = getAdminDictionary();
  return log.rows.map((row) => activityItem(row, names, dictionary));
}

/** حالة النظام للمالك والمدير (`system.read`). */
async function loadSystem(club: ClubSummary, role: StaffRole) {
  return hasPermission(role, "system.read")
    ? systemStatus(await staffMfaCoverage(getDb(), club.id))
    : null;
}

/**
 * نظرة عامة: أرقام حقيقية من القاعدة فقط، وكل قسم بصلاحيته. من لا يملك `overview.read` (المحرر)
 * يُحوَّل إلى نصوص الموقع (أو حسابه) بدل صفحة أرقام مبيعات لا تخصه.
 */
export default async function OverviewPage() {
  const { staff } = await requireStaff("account.self");
  if (!hasPermission(staff.role, "overview.read")) {
    redirect(
      hasPermission(staff.role, "content.read") ? ADMIN_ROUTES.contentTexts : ADMIN_ROUTES.account,
    );
  }
  const club = (await staffClub(staff.clubId)) ?? notFound();
  const now = new Date();
  const db = getDb();
  const [series, awaiting, orders, activity, system] = await Promise.all([
    dailyOrderSeries(db, club, now, OVERVIEW_CHART_DAYS),
    countAwaitingPayment(db, club.id, now),
    listRecentOrders(db, club.id, now, OVERVIEW_RECENT_ORDERS),
    loadActivity(club, staff.role),
    loadSystem(club, staff.role),
  ]);
  const { overview } = getAdminDictionary();
  const kpis = {
    created: kpiOf(series, (day) => day.created, OVERVIEW_SPARK_DAYS),
    paid: kpiOf(series, (day) => day.paid, OVERVIEW_SPARK_DAYS),
    revenue: kpiOf(series, (day) => day.revenueMinor, OVERVIEW_SPARK_DAYS),
    awaiting,
    currency: club.currency,
  };
  const when = { now, timezone: club.timezone };
  const split = (side: unknown) =>
    cx(overviewStyles.columns, side !== null && overviewStyles.split);
  return (
    <>
      <PageHeader
        title={overview.title}
        description={fill(overview.description, {
          name: staff.displayName,
          date: formatDay(now, club.timezone),
        })}
      />
      <KpiStrip kpis={kpis} text={overview.kpis} />
      <div className={split(system)}>
        <Card title={overview.chart.title} description={overview.chart.description}>
          <span id={CHART_TITLE_ID} className="sr-only">
            {overview.chart.title}
          </span>
          <OrdersChart series={series} text={overview.chart} titleId={CHART_TITLE_ID} />
        </Card>
        {system === null ? null : <SystemCard status={system} text={overview.system} />}
      </div>
      <div className={split(activity)}>
        <RecentOrders orders={orders} text={overview} {...when} />
        {activity === null ? null : (
          <ActivityFeed items={activity} text={overview.activity} {...when} />
        )}
      </div>
    </>
  );
}
