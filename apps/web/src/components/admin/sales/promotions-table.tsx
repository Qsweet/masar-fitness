import type { PromotionAdminRow } from "@masar/db";
import Link from "next/link";
import { promotionPath } from "@/config/admin";
import type { AdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { discountText, usageText, windowText } from "@/server/admin/sales/promotions-view";
import { Cell, DataTable } from "../ui/data-table";
import { Ltr } from "../ui/kit";
import { PromotionStateBadge } from "./catalog-parts";
import styles from "./sales.module.css";

interface PromotionsTableProps {
  readonly rows: readonly PromotionAdminRow[];
  readonly sales: AdminDictionary["sales"];
  readonly timezone: string;
  readonly caption: string;
}

/**
 * جدول العروض بعدّاداتها الحقيقية. على الهاتف كل صف سطران: الاسم والحالة، ثم الخصم والاستخدام؛ والنافذة
 * والرمز في صفحة العرض.
 */
export function PromotionsTable({ rows, sales, timezone, caption }: PromotionsTableProps) {
  const text = sales.promotions;
  const { columns } = text;
  return (
    <DataTable caption={caption} columns={Object.values(columns)} testId="promotions-table" compact>
      {rows.map((row) => (
        <tr key={row.rule.id}>
          <Cell label={columns.name} slot="title">
            <Link
              href={promotionPath(row.rule.id)}
              prefetch={false}
              className={styles.rowLink}
              aria-label={fill(text.open, { name: row.rule.name.ar })}
            >
              {row.rule.name.ar}
            </Link>
            <span className={styles.sub}>
              {row.rule.code === null ? text.types.automatic : text.types.coupon}
            </span>
          </Cell>
          <Cell label={columns.code} slot="aside" nowrap>
            {row.rule.code === null ? "—" : <Ltr>{row.rule.code}</Ltr>}
          </Cell>
          <Cell label={columns.discount} slot="value" nowrap strong>
            <bdi>{discountText(row.rule.discount)}</bdi>
          </Cell>
          <Cell label={columns.window} muted>
            {windowText(row.rule, timezone, text)}
          </Cell>
          <Cell label={columns.usage} slot="meta" nowrap>
            {usageText(row, text)}
          </Cell>
          <Cell label={columns.state} slot="badge">
            <PromotionStateBadge state={row.state} statuses={sales.statuses} />
          </Cell>
        </tr>
      ))}
    </DataTable>
  );
}
