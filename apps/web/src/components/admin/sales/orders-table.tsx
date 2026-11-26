import type { OrderListRow } from "@masar/db";
import Link from "next/link";
import { orderPath } from "@/config/admin";
import type { AdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { Cell, DataTable } from "../ui/data-table";
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
  return (
    <DataTable caption={caption} columns={Object.values(columns)} testId="orders-table" compact>
      {rows.map((row) => (
        <tr key={row.id}>
          <Cell label={columns.reference} slot="title" nowrap>
            <Link
              href={orderPath(row.id)}
              prefetch={false}
              className={styles.rowLink}
              aria-label={fill(open, { reference: row.reference })}
            >
              <Ltr>{row.reference}</Ltr>
            </Link>
          </Cell>
          <Cell label={columns.created} slot="meta" muted nowrap>
            <When at={row.createdAt} now={now} timezone={timezone} />
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
          <Cell label={columns.total} slot="value" nowrap>
            <Amount value={row.total} />
          </Cell>
          <Cell label={columns.status} slot="badge">
            <OrderStatusBadge status={row.status} statuses={sales.statuses} />
          </Cell>
          <Cell label={columns.payment} muted nowrap>
            <PaymentMethod provider={row.paidProvider} statuses={sales.statuses} />
          </Cell>
        </tr>
      ))}
    </DataTable>
  );
}
