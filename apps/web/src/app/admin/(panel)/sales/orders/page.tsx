import {
  listOrders,
  listOrdersWithCounts,
  type OrderListPage,
  type OrderTabCounts,
} from "@masar/db";
import { formatPlainDate, plainDateInZone } from "@masar/domain";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OrdersFilters } from "@/components/admin/sales/orders-filters";
import { OrdersTable } from "@/components/admin/sales/orders-table";
import { TableCard } from "@/components/admin/ui/data-table";
import { ButtonLink, EmptyState, PageHeader, Tabs } from "@/components/admin/ui/kit";
import { Pagination } from "@/components/admin/ui/pagination";
import { ADMIN_ROUTES, FALLBACK_TIMEZONE, orderPath, ORDERS_PAGE_SIZE } from "@/config/admin";
import { getAdminDictionary, type AdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { formatNumber } from "@/i18n/format";
import { staffClub } from "@/server/admin/club";
import { requireStaff } from "@/server/admin/guard";
import { ordersHref, parseOrdersQuery, type OrdersFilter } from "@/server/admin/sales/orders-query";
import { getDb } from "@/server/db";
import { ORDER_LIST_TABS } from "@masar/db";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().sales.orders.title };
}

type OrdersText = AdminDictionary["sales"]["orders"];

/** نص الحالة الفارغة بحسب ما طُلب: مرجع لا يطابق، مدى غير صحيح، تبويب فارغ، أو فترة بلا طلبات. */
function emptyText(filter: OrdersFilter, text: OrdersText["empty"]) {
  if (filter.reference !== null) {
    return filter.reference.normalized === null
      ? { title: text.invalidReferenceTitle, lead: text.referenceLead }
      : { title: text.referenceTitle, lead: text.referenceLead };
  }
  if (filter.invalidRange) {
    return { title: text.invalidRangeTitle, lead: text.invalidRangeLead };
  }
  return {
    title: filter.tab === "all" ? text.rangeTitle : text.tabTitle,
    lead: text.rangeLead,
  };
}

/** الفارغ بسببه: الفلتر يقول ذلك ويعطي «امسح». */
function OrdersEmpty({
  filter,
  text,
}: {
  readonly filter: OrdersFilter;
  readonly text: OrdersText;
}) {
  const empty = emptyText(filter, text.empty);
  return (
    <EmptyState icon="orders" title={empty.title} description={empty.lead}>
      {filter.customRange || filter.reference !== null ? (
        <ButtonLink href={ADMIN_ROUTES.orders} size="small">
          {text.filters.clear}
        </ButtonLink>
      ) : null}
    </EmptyState>
  );
}

const NOTHING: OrderListPage = { rows: [], total: 0 };

interface Loaded {
  readonly page: OrderListPage;
  /** null حين لا معنى للعدّادات: بحث بالمرجع (يتجاوز التبويب والمدى) أو مدى غير صحيح. */
  readonly counts: OrderTabCounts | null;
}

/**
 * ما يُقرأ من القاعدة بحسب التصفية. البحث بالمرجع مطابقة تامة يتجاوز التبويب والمدى، فلا عدّادات معه.
 * وإلا القائمة وعدّادات تبويباتها بحدّي مدى محسوبين مرة.
 */
async function loadOrders(clubId: string, filter: OrdersFilter, now: Date): Promise<Loaded> {
  const base = { clubId, pageSize: ORDERS_PAGE_SIZE, now };
  if (filter.reference !== null) {
    const reference = filter.reference.normalized;
    const page =
      reference === null
        ? NOTHING
        : await listOrders(getDb(), { ...base, tab: "all", page: 1, reference });
    return { page, counts: null };
  }
  if (filter.invalidRange) {
    return { page: NOTHING, counts: null };
  }
  const { tab, from, to, page } = filter;
  return listOrdersWithCounts(getDb(), { ...base, tab, from, to, page });
}

interface PagerProps {
  readonly text: OrdersText;
  readonly filter: OrdersFilter;
  readonly page: OrderListPage;
}

function OrdersPagination({ text, filter, page: { rows, total } }: PagerProps) {
  const shown = rows.length;
  const first = (filter.page - 1) * ORDERS_PAGE_SIZE + 1;
  const range = fill(text.range, {
    from: formatNumber(shown === 0 ? 0 : first),
    to: formatNumber(shown === 0 ? 0 : first + shown - 1),
    total: formatNumber(total),
  });
  const hasOlder = filter.page * ORDERS_PAGE_SIZE < total;
  const href = (page: number) => ordersHref(filter, { page });
  return (
    <Pagination
      label={text.pagination}
      range={range}
      rangeTestId="orders-range"
      previous={{ label: text.newer, href: filter.page > 1 ? href(filter.page - 1) : null }}
      next={{ label: text.older, href: hasOlder ? href(filter.page + 1) : null }}
    />
  );
}

/** قائمة الطلبات: تبويبات بالحالة الفعلية، ومدى بتقويم النادي، وبحث بالمرجع يفتح الطلب مباشرة. */
export default async function OrdersPage(props: PageProps<"/admin/sales/orders">) {
  const { staff } = await requireStaff("orders.read");
  const [query, club] = await Promise.all([props.searchParams, staffClub(staff.clubId)]);
  const timezone = club?.timezone ?? FALLBACK_TIMEZONE;
  const now = new Date();
  const today = plainDateInZone(now, timezone);
  const filter = parseOrdersQuery(query, today);
  const { page, counts } = await loadOrders(staff.clubId, filter, now);
  const [only] = page.rows;
  if (filter.reference !== null && page.total === 1 && only !== undefined) {
    redirect(orderPath(only.id));
  }
  const { sales } = getAdminDictionary();
  const text = sales.orders;
  return (
    <>
      <PageHeader title={text.title} description={text.lead} />
      <Tabs
        label={text.tabsLabel}
        current={filter.tab}
        tabs={ORDER_LIST_TABS.map((tab) => ({
          id: tab,
          label: text.tabs[tab],
          href: ordersHref(filter, { tab }),
          count: counts === null ? undefined : formatNumber(counts[tab]),
        }))}
      />
      <TableCard
        toolbar={
          <OrdersFilters text={text.filters} filter={filter} today={formatPlainDate(today)} />
        }
        footer={
          page.total === 0 ? undefined : (
            <OrdersPagination text={text} filter={filter} page={page} />
          )
        }
      >
        {page.rows.length === 0 ? (
          <OrdersEmpty filter={filter} text={text} />
        ) : (
          <OrdersTable
            rows={page.rows}
            sales={sales}
            now={now}
            timezone={timezone}
            caption={text.title}
            page
          />
        )}
      </TableCard>
    </>
  );
}
