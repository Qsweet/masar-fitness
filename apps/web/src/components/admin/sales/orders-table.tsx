import type { OrderListRow } from "@masar/db";
import { orderPath } from "@/config/admin";
import type { AdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { Cell, DataTable, RowLink } from "../ui/data-table";
import { Ltr } from "../ui/kit";
import { Amount, OrderStatusBadge, PaymentMethod, When } from "./order-parts";
import styles from "./sales.module.css";

interface OrdersTableProps {
  readonly rows: readonly OrderListRow[];
  readonly sales: AdminDictionary["sales"];
  readonly now: Date;
  readonly timezone: string;
  readonly caption: string;
}

/**
 * جدول الطلبات المشترك بين القائمة وصفحة العميل. على الهاتف كل صف سطران: المرجع والاسم والحالة، ثم
 * الإجمالي والوقت؛ والجوال والباقة وطريقة الدفع في التفصيل.
 */
export function OrdersTable({ rows, sales, now, timezone, caption }: OrdersTableProps) {
  const { columns, moreItems, open } = sales.orders;
  const headers = Object.entries(columns).map(([key, label]) =>
    key === "total" ? { label, align: "numeric" as const } : label,
  );
  return (
    <DataTable caption={caption} columns={headers} testId="orders-table" compact>
      {rows.map((row) => (
        <tr key={row.id}>
          <Cell label={columns.reference} slot="title" nowrap>
            <RowLink href={orderPath(row.id)} label={fill(open, { reference: row.reference })}>
              <Ltr>{row.reference}</Ltr>
            </RowLink>
          </Cell>
          <Cell label={columns.customer} slot="aside">
            {row.customerName}
          </Cell>
          <Cell label={columns.phone} muted nowrap>
            <Ltr>{row.maskedPhone}</Ltr>
          </Cell>
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
