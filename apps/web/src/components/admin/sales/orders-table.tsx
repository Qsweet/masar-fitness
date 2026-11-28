import type { OrderListRow } from "@masar/db";
import { orderPath } from "@/config/admin";
import type { AdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { alignColumns, Cell, DataTable, RowLink } from "../ui/data-table";
import { Ltr } from "../ui/kit";
import { Amount, OrderStatusBadge, PaymentMethod, When } from "./order-parts";
import styles from "./sales.module.css";

interface OrdersTableProps {
  readonly rows: readonly OrderListRow[];
  readonly sales: AdminDictionary["sales"];
  readonly now: Date;
  readonly timezone: string;
  readonly caption: string;
  /** قائمة الطلبات الكاملة: رأس لاصق. في صفحة العميل جدول داخل عمود، بلا عمودي العميل والجوال. */
  readonly page?: boolean;
}

/**
 * جدول الطلبات المشترك بين القائمة وصفحة العميل. على الهاتف كل صف سطران: المرجع والاسم والحالة، ثم
 * الإجمالي والوقت؛ والجوال والباقة وطريقة الدفع في التفصيل.
 */
export function OrdersTable({ rows, sales, now, timezone, caption, page }: OrdersTableProps) {
  const { moreItems, open } = sales.orders;
  const full = page === true;
  const { customer, phone, ...rest } = sales.orders.columns;
  const columns = full ? sales.orders.columns : rest;
  return (
    <DataTable
      caption={caption}
      columns={alignColumns(columns, ["total"])}
      testId="orders-table"
      compact
      sticky={full}
    >
      {rows.map((row) => (
        <tr key={row.id}>
          <Cell label={columns.reference} slot="title" nowrap>
            <RowLink href={orderPath(row.id)} label={fill(open, { reference: row.reference })}>
              <Ltr>{row.reference}</Ltr>
            </RowLink>
          </Cell>
          {full ? (
            <>
              <Cell label={customer} slot="aside">
                {row.customerName}
              </Cell>
              <Cell label={phone} muted nowrap>
                <Ltr>{row.maskedPhone}</Ltr>
              </Cell>
            </>
          ) : null}
          <Cell label={columns.item}>
            {row.itemName.ar}
            {row.itemCount > 1 ? (
              <span className={styles.sub}>
                {fill(moreItems, { count: String(row.itemCount - 1) })}
              </span>
            ) : null}
          </Cell>
          <Cell label={columns.status} slot="badge">
            <OrderStatusBadge status={row.status} statuses={sales.statuses} />
          </Cell>
          <Cell label={columns.payment} muted nowrap>
            <PaymentMethod
              provider={row.paidProvider}
              manualMethod={row.manualMethod}
              statuses={sales.statuses}
            />
          </Cell>
          <Cell label={columns.total} slot="value" align="numeric">
            <Amount value={row.total} />
          </Cell>
          <Cell label={columns.created} slot="meta" muted nowrap>
            <When at={row.createdAt} now={now} timezone={timezone} />
          </Cell>
        </tr>
      ))}
    </DataTable>
  );
}
