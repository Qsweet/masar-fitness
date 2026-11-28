import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import styles from "./table.module.css";

type Align = "end" | "numeric";

/** عمود باسمه، أو باسمه ومحاذاته (الأرقام في جهة النهاية رأسًا وخلايا). */
export type Column = string | { readonly label: string; readonly align: Align };

/** أعمدة من قاموس بترتيبه، والمفاتيح الرقمية محاذاة في جهة النهاية. */
export function alignColumns(
  columns: Readonly<Record<string, string>>,
  numeric: readonly string[],
): Column[] {
  return Object.entries(columns).map(([key, label]) =>
    numeric.includes(key) ? { label, align: "numeric" } : label,
  );
}

function columnLabel(column: Column): string {
  return typeof column === "string" ? column : column.label;
}

function columnAlign(column: Column): Align | undefined {
  return typeof column === "string" ? undefined : column.align;
}

interface DataTableProps {
  /** اسم الجدول لقارئ الشاشة. */
  readonly caption: string;
  readonly columns: readonly Column[];
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

/**
 * جدول بيانات v2 (ADMIN_REDESIGN §6.1): رأس لاصق تحت الشريط العلوي على الشاشة الواسعة، وخطوط شعرية،
 * وارتفاع صف من رمز الكثافة، والأرقام جدولية في جهة النهاية، والصف كله رابط حين فيه `RowLink`.
 */
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
            {columns.map((column) => {
              const align = columnAlign(column);
              return (
                <th
                  key={columnLabel(column)}
                  scope="col"
                  className={align === undefined ? undefined : styles[align]}
                >
                  {columnLabel(column)}
                </th>
              );
            })}
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

interface RowLinkProps {
  readonly href: string;
  /** اسم الرابط لقارئ الشاشة («افتح الطلب MSR-…»). */
  readonly label: string;
  readonly children: ReactNode;
}

/**
 * رابط الصف: نصه في خليته الأولى، ومساحة نقره تمتد على الصف كله (طبقة شفافة فوق الصف). بقية الأزرار
 * والروابط في الصف فوقها، فتبقى تعمل. بلا JavaScript.
 */
export function RowLink({ href, label, children }: RowLinkProps) {
  return (
    <Link href={href} prefetch={false} className={styles.rowLink} aria-label={label}>
      {children}
    </Link>
  );
}

interface TableCardProps {
  /** شريط الأدوات فوق الجدول (بحث، تصفية). */
  readonly toolbar?: ReactNode;
  /** أسفل الجدول (الترقيم). */
  readonly footer?: ReactNode;
  readonly children: ReactNode;
}

/** بطاقة الجدول: شريط الأدوات ثم الجدول أو حالته الفارغة ثم الترقيم، بخطوط شعرية بينها. */
export function TableCard({ toolbar, footer, children }: TableCardProps) {
  return (
    <section className={styles.card}>
      {toolbar === undefined ? null : <div className={styles.toolbar}>{toolbar}</div>}
      {children}
      {footer === undefined ? null : <div className={styles.footer}>{footer}</div>}
    </section>
  );
}

export { styles as tableStyles };
