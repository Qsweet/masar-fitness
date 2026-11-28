import { getCustomerDetail, listOrders, type CustomerDetail, type OrderListPage } from "@masar/db";
import { hasPermission } from "@masar/domain";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  CustomerAssessments,
  CustomerMemberships,
} from "@/components/admin/sales/customer-sections";
import { OrdersTable } from "@/components/admin/sales/orders-table";
import { RevealPhone } from "@/components/admin/sales/reveal-phone";
import salesStyles from "@/components/admin/sales/sales.module.css";
import { TableCard } from "@/components/admin/ui/data-table";
import { Card, DetailLayout, EmptyState, Facts, Ltr, PageHeader } from "@/components/admin/ui/kit";
import { ADMIN_ROUTES, CUSTOMER_ORDERS_SHOWN } from "@/config/admin";
import { getAdminDictionary, type AdminDictionary } from "@/i18n/admin";
import { formatDateTime } from "@/i18n/admin/format";
import { isUuid } from "@/server/admin/form";
import { requireStaff } from "@/server/admin/guard";
import { getDb } from "@/server/db";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().sales.customers.detail.title };
}

function customerFacts(
  customer: CustomerDetail,
  text: AdminDictionary["sales"]["customers"]["detail"],
  reveal: ReactNode,
): (readonly [string, ReactNode])[] {
  const when = (date: Date) => formatDateTime(date, customer.timeZone);
  return [
    [
      text.phone,
      <div key="phone">
        <Ltr>
          <span data-testid="masked-phone">{customer.maskedPhone}</span>
        </Ltr>
        {reveal}
      </div>,
    ],
    [text.since, when(customer.createdAt)],
    [text.firstOrder, customer.firstOrderAt === null ? text.noOrders : when(customer.firstOrderAt)],
  ];
}

/**
 * صفحة عميل للقراءة فقط: جواله مقنَّعًا وكشفه المدقَّق، وطلباته واشتراكاته وطلبات تقييمه. بلا اسم
 * (الأسماء لقطات على الطلبات) وبلا تعديل: نظام العملاء هو الـCRM.
 */
interface CustomerOrdersProps {
  readonly orders: OrderListPage;
  readonly sales: AdminDictionary["sales"];
  readonly now: Date;
  readonly timezone: string;
}

/** آخر طلبات العميل جدولًا داخل العمود الرئيسي، بلا عمودي العميل والجوال. */
function CustomerOrders({ orders, sales, now, timezone }: CustomerOrdersProps) {
  const text = sales.customers.detail;
  return (
    <TableCard title={text.orders}>
      {orders.rows.length === 0 ? (
        <EmptyState icon="orders" title={text.ordersEmptyTitle} />
      ) : (
        <OrdersTable
          rows={orders.rows}
          sales={sales}
          now={now}
          timezone={timezone}
          caption={text.orders}
        />
      )}
    </TableCard>
  );
}

export default async function CustomerPage(props: PageProps<"/admin/sales/customers/[id]">) {
  const { staff } = await requireStaff("customers.read");
  const { id } = await props.params;
  const db = getDb();
  const now = new Date();
  const customer = isUuid(id) ? await getCustomerDetail(db, staff.clubId, id, now) : undefined;
  if (customer === undefined) {
    notFound();
  }
  const orders = await listOrders(db, {
    clubId: staff.clubId,
    customerId: customer.id,
    tab: "all",
    page: 1,
    pageSize: CUSTOMER_ORDERS_SHOWN,
    now,
  });
  const { sales, errors } = getAdminDictionary();
  const text = sales.customers.detail;
  const reveal = hasPermission(staff.role, "customers.reveal_phone") ? (
    <RevealPhone
      source="customer"
      id={customer.id}
      labels={{ ...sales.customers.reveal, errors }}
    />
  ) : null;
  return (
    <>
      <PageHeader
        back={{ href: ADMIN_ROUTES.customers, label: sales.customers.title }}
        title={text.title}
      />
      <DetailLayout
        aside={
          <Card title={text.facts}>
            <div className={salesStyles.stack}>
              <Facts items={customerFacts(customer, text, reveal)} />
              <p className={salesStyles.note}>{text.nameNote}</p>
            </div>
          </Card>
        }
        main={
          <>
            <CustomerOrders orders={orders} sales={sales} now={now} timezone={customer.timeZone} />
            <CustomerMemberships customer={customer} sales={sales} />
            <CustomerAssessments customer={customer} sales={sales} />
          </>
        }
      />
    </>
  );
}
