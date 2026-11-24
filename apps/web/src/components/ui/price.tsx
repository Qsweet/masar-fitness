import type { MoneyParts } from "@/i18n/format";

interface PriceProps {
  readonly parts: MoneyParts;
  readonly className?: string;
  readonly unitClassName?: string;
}

/** المبلغ ووحدته لا ينفصلان على سطرين، والرقم معزول الاتجاه حتى لا ينقلب داخل نص عربي. */
export function Price({ parts, className = "", unitClassName = "" }: PriceProps) {
  return (
    <span className={`whitespace-nowrap ${className}`}>
      <bdi>{parts.amount}</bdi> <span className={unitClassName}>{parts.unit}</span>
    </span>
  );
}
