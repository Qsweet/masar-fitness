import type { MoneyParts } from "@/i18n/format";
import { cx } from "@/lib/cx";
import styles from "./price.module.css";

interface PriceProps {
  readonly parts: MoneyParts;
  readonly className?: string | undefined;
  readonly unitClassName?: string | undefined;
}

/** المبلغ ووحدته لا ينفصلان على سطرين، والرقم معزول الاتجاه حتى لا ينقلب داخل نص عربي. */
export function Price({ parts, className, unitClassName }: PriceProps) {
  return (
    <span className={cx(styles.price, className)}>
      <bdi>{parts.amount}</bdi> <span className={unitClassName}>{parts.unit}</span>
    </span>
  );
}
