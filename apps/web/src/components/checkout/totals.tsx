import type { ReactNode } from "react";
import { Price } from "@/components/ui/price";
import type { Dictionary } from "@/i18n/dictionaries";
import type { DiscountView, LineView, TotalsView } from "./checkout-view";
import styles from "./quote-summary.module.css";

type SummaryLabels = Dictionary["checkout"]["summary"];

/** السطور بسعر القائمة، وما يليها اختياري (مزايا السطر وقاعدة بدئه في مراجعة الطلب). */
export function LineList<L extends LineView>({
  lines,
  renderExtra,
}: {
  lines: readonly L[];
  renderExtra?: (line: L) => ReactNode;
}) {
  return (
    <ul className={styles.lines}>
      {lines.map((line) => (
        <li key={line.key} className={styles.line}>
          <span className={styles.lineName}>{line.name}</span>
          <Price parts={line.price} className={styles.amount} />
          {line.detail === undefined ? null : (
            <span className={styles.lineDetail}>{line.detail}</span>
          )}
          {renderExtra?.(line)}
        </li>
      ))}
    </ul>
  );
}

/** المجموع والخصومات بأسمائها والإجمالي الشامل و«منه ضريبة القيمة المضافة». */
export function Totals({
  discounts,
  totals,
  labels,
}: {
  discounts: readonly DiscountView[];
  totals: TotalsView;
  labels: SummaryLabels;
}) {
  return (
    <>
      {totals.discount === undefined ? null : (
        <dl className={styles.rows}>
          <div className={styles.row}>
            <dt>{labels.subtotal}</dt>
            <dd>
              <Price parts={totals.subtotal} />
            </dd>
          </div>
          {discounts.map((discount) => (
            <div key={discount.key} className={styles.row}>
              <dt>
                {discount.name}
                {discount.code === undefined ? null : (
                  <span className={styles.code}>{discount.code}</span>
                )}
              </dt>
              <dd>
                − <Price parts={discount.amount} />
              </dd>
            </div>
          ))}
        </dl>
      )}
      <div>
        <p className={styles.totalLabel}>{labels.total}</p>
        <p className={styles.total} data-testid="order-total">
          <Price parts={totals.total} unitClassName={styles.totalUnit} />
        </p>
        <p className={styles.totalLabel}>
          {totals.vatLabel}: <Price parts={totals.vat} />
        </p>
      </div>
    </>
  );
}
