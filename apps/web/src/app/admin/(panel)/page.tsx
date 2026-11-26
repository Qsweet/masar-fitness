import { countOrdersToday } from "@masar/db";
import { hasPermission, ORDER_STATUSES } from "@masar/domain";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader, pageStyles, Panel } from "@/components/admin/page-parts";
import { ADMIN_ROUTES } from "@/config/admin";
import { getAdminDictionary } from "@/i18n/admin";
import { formatDay } from "@/i18n/admin/format";
import { fill } from "@/i18n/fill";
import { formatNumber } from "@/i18n/format";
import { cx } from "@/lib/cx";
import { staffClub } from "@/server/admin/club";
import { requireStaff } from "@/server/admin/guard";
import { getDb } from "@/server/db";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().overview.title };
}

/**
 * نظرة عامة: أرقام حقيقية من القاعدة فقط (طلبات اليوم بحالاتها). من لا يملك `overview.read` (المحرر)
 * يُحوَّل إلى حسابه بدل صفحة أرقام مبيعات لا تخصه.
 */
export default async function OverviewPage() {
  const { staff } = await requireStaff("account.self");
  if (!hasPermission(staff.role, "overview.read")) {
    redirect(ADMIN_ROUTES.account);
  }
  const club = (await staffClub(staff.clubId)) ?? notFound();
  const now = new Date();
  const counts = await countOrdersToday(getDb(), club, now);
  const { overview } = getAdminDictionary();
  const total = ORDER_STATUSES.reduce((sum, status) => sum + counts[status], 0);
  return (
    <>
      <PageHeader
        title={overview.title}
        lead={fill(overview.greeting, { name: staff.displayName })}
      />
      <Panel
        title={overview.ordersTitle}
        lead={fill(overview.ordersLead, { date: formatDay(now, club.timezone) })}
      >
        <dl className={pageStyles.stats} data-testid="orders-today">
          <div className={cx(pageStyles.stat, pageStyles.statLead)}>
            <dd className={pageStyles.statValue}>{formatNumber(total)}</dd>
            <dt className={pageStyles.statLabel}>{overview.total}</dt>
          </div>
          {ORDER_STATUSES.map((status) => (
            <div key={status} className={pageStyles.stat}>
              <dd className={pageStyles.statValue}>{formatNumber(counts[status])}</dd>
              <dt className={pageStyles.statLabel}>{overview.orderStatuses[status]}</dt>
            </div>
          ))}
        </dl>
        {total === 0 ? <p className={pageStyles.muted}>{overview.empty}</p> : null}
      </Panel>
    </>
  );
}
