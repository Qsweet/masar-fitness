import { getSalesSettings, listPromotionsWithUsage } from "@masar/db";
import { hasPermission } from "@masar/domain";
import type { Metadata } from "next";
import { PromotionsTable } from "@/components/admin/sales/promotions-table";
import { ButtonLink, Card, EmptyState, PageHeader, Tabs } from "@/components/admin/ui/kit";
import { ADMIN_ROUTES } from "@/config/admin";
import { getAdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { formatNumber } from "@/i18n/format";
import { requireStaff } from "@/server/admin/guard";
import {
  countByState,
  parsePromotionTab,
  PROMOTION_TABS,
  rowsOfTab,
  type PromotionTab,
} from "@/server/admin/sales/promotions-view";
import { getDb } from "@/server/db";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().sales.promotions.title };
}

function tabHref(tab: PromotionTab): string {
  return tab === "all" ? ADMIN_ROUTES.promotions : `${ADMIN_ROUTES.promotions}?tab=${tab}`;
}

/**
 * العروض والكوبونات بحالتها المعروضة (مسودة، مجدول، سارٍ، متوقف، انتهت نافذته، مستنفد، منتهٍ) وعدّاد
 * استخدامها النشط من الطلبات نفسها. دور المبيعات يقرأ ليذكر الرموز للعميل، ولا يعدّل.
 */
export default async function PromotionsPage(props: PageProps<"/admin/sales/promotions">) {
  const { staff } = await requireStaff("promotions.read");
  const query = await props.searchParams;
  const db = getDb();
  const [rows, club] = await Promise.all([
    listPromotionsWithUsage(db, staff.clubId, new Date()),
    getSalesSettings(db, staff.clubId),
  ]);
  const { sales } = getAdminDictionary();
  const text = sales.promotions;
  const tab = parsePromotionTab(query.tab);
  const shown = rowsOfTab(rows, tab);
  const counts = countByState(rows);
  const label = (id: PromotionTab): string =>
    fill(text.tabCount, {
      label: id === "all" ? text.all : sales.statuses.promotionState[id],
      count: formatNumber(id === "all" ? rows.length : counts[id]),
    });
  const add = hasPermission(staff.role, "promotions.write") ? (
    <ButtonLink href={ADMIN_ROUTES.promotionsNew} variant="primary">
      {text.add}
    </ButtonLink>
  ) : null;
  return (
    <>
      <PageHeader title={text.title} description={text.lead}>
        {add}
      </PageHeader>
      <Tabs
        label={text.tabsLabel}
        current={tab}
        tabs={PROMOTION_TABS.map((id) => ({ id, label: label(id), href: tabHref(id) }))}
      />
      <Card flush>
        {shown.length === 0 ? (
          <EmptyState
            icon="promotions"
            title={rows.length === 0 ? text.empty.title : text.empty.tabTitle}
            description={rows.length === 0 ? text.empty.lead : text.empty.tabLead}
          >
            {rows.length === 0 ? add : null}
          </EmptyState>
        ) : (
          <PromotionsTable
            rows={shown}
            sales={sales}
            timezone={club.timezone}
            caption={text.title}
          />
        )}
      </Card>
    </>
  );
}
