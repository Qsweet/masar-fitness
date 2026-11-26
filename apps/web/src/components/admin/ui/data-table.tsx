import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import styles from "./table.module.css";

interface DataTableProps {
  /** اسم الجدول لقارئ الشاشة. */
  readonly caption: string;
  readonly columns: readonly string[];
  /** عمود أخير لأفعال الصف، برأس مخفي بصريًا. */
  readonly actionsLabel?: string;
  readonly testId?: string;
  /**
   * على الهاتف: الصف سطران مضغوطان بدل بطاقة بتسميات. الخلايا تأخذ مواضعها بـ`slot`، وما لا موضع له
   * يختفي على الهاتف (يبقى في صفحة التفصيل).
   */
  readonly compact?: boolean;
  readonly children: ReactNode;
}

/** جدول بيانات: الصفوف تُمرَّر أبناءً من `Row` و`Cell`. */
export function DataTable({
  caption,
  columns,
  actionsLabel,
  testId,
  compact,
  children,
}: DataTableProps) {
  return (
    <div className={styles.wrap}>
      <table className={cx(styles.table, compact === true && styles.compact)} data-testid={testId}>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
            {actionsLabel === undefined ? null : (
              <th scope="col">
                <span className="sr-only">{actionsLabel}</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

interface CellProps {
  /** تسمية العمود: تظهر بجانب القيمة حين يصير الصف بطاقة على الهاتف. فارغة لخلية الأفعال. */
  readonly label: string;
  readonly align?: "end" | "numeric";
  readonly nowrap?: boolean;
  readonly muted?: boolean;
  readonly strong?: boolean;
  /**
   * موضع الخلية في الصف المضغوط على الهاتف: العنوان والشارة في السطر الأول وبينهما `aside`، والقيمة
   * و`meta` في الثاني.
   */
  readonly slot?: CellSlot;
  readonly children: ReactNode;
}

export type CellSlot = "title" | "aside" | "badge" | "value" | "meta";

export function Cell({ label, align, nowrap, muted, strong, slot, children }: CellProps) {
  return (
    <td
      data-label={label}
      data-slot={slot}
      className={cx(
        align !== undefined && styles[align],
        nowrap === true && styles.nowrap,
        muted === true && styles.mutedCell,
        strong === true && styles.strongCell,
      )}
    >
      {/* عنصر واحد: على الهاتف الخلية صف «تسمية ← قيمة»، والقيمة لا تتفرق أجزاؤها */}
      <span>{children}</span>
    </td>
  );
}

export { styles as tableStyles };
