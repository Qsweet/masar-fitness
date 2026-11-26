import type { CatalogProductRow } from "@masar/db";
import Link from "next/link";
import { planPath } from "@/config/admin";
import type { AdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { formatMonths, formatNumber } from "@/i18n/format";
import { Cell, DataTable } from "../ui/data-table";
import { Badge } from "../ui/kit";
import { ProductStatusBadge } from "./catalog-parts";
import { Amount } from "./order-parts";
import styles from "./sales.module.css";

interface PlansTableProps {
  readonly rows: readonly CatalogProductRow[];
  readonly sales: AdminDictionary["sales"];
  /** معرّف الباقة التي تحمل شارة «الأكثر قيمة» في الموقع الآن (محسوبة). */
  readonly bestSlug: string | undefined;
  readonly caption: string;
}

function durationText(row: CatalogProductRow, text: AdminDictionary["sales"]["plans"]): string {
  const months = row.currentVersion?.durationMonths ?? null;
  const bonus = row.currentVersion?.bonusMonths ?? 0;
  if (months === null) {
    return row.kind === "membership" ? text.noDuration : "—";
  }
  const paid = formatMonths(months, "ar");
  return bonus === 0 ? paid : `${paid} + ${formatMonths(bonus, "ar")}`;
}

/**
 * جدول منتجات نوع واحد بكل حالاتها. على الهاتف كل صف سطران: الاسم والحالة، ثم السعر والمدة؛ والباقي في
 * صفحة المنتج.
 */
export function PlansTable({ rows, sales, bestSlug, caption }: PlansTableProps) {
  const text = sales.plans;
  const { columns } = text;
  return (
    <DataTable caption={caption} columns={Object.values(columns)} testId="plans-table" compact>
      {rows.map((row) => (
        <tr key={row.id}>
          <Cell label={columns.name} slot="title">
            <Link
              href={planPath(row.id)}
              prefetch={false}
              className={styles.rowLink}
              aria-label={fill(text.open, { name: row.name.ar })}
            >
              {row.name.ar}
            </Link>
            {row.tier === null ? null : <span className={styles.sub}>{row.tier.ar}</span>}
            {row.slug === bestSlug ? (
              <span className={styles.inlineBadge}>
                <Badge tone="accent">{text.bestValue}</Badge>
              </span>
            ) : null}
          </Cell>
          <Cell label={columns.price} slot="value" nowrap>
            {row.currentVersion === null ? (
              text.noVersion
            ) : (
              <Amount value={row.currentVersion.price} />
            )}
          </Cell>
          <Cell label={columns.duration} slot="meta" muted nowrap>
            {durationText(row, text)}
          </Cell>
          <Cell label={columns.status} slot="badge">
            <ProductStatusBadge status={row.status} statuses={sales.statuses} />
          </Cell>
          <Cell label={columns.sellable} muted nowrap>
            {row.sellable ? text.sellable : text.notSellable}
          </Cell>
          <Cell label={columns.sold} align="numeric" muted>
            {formatNumber(row.soldItems)}
          </Cell>
          <Cell label={columns.sortOrder} align="numeric" muted>
            {formatNumber(row.sortOrder)}
          </Cell>
        </tr>
      ))}
    </DataTable>
  );
}
