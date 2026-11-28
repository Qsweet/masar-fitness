import Link from "next/link";
import { cx } from "@/lib/cx";
import { buttonClass } from "./kit";
import { uiStyles as styles } from "./ui-styles";

interface PaginationProps {
  readonly label: string;
  /** «1 إلى 25 من 310». */
  readonly range: string;
  readonly previous: { readonly label: string; readonly href: string | null };
  readonly next: { readonly label: string; readonly href: string | null };
  readonly rangeTestId?: string;
}

function PageLink({ label, href }: { readonly label: string; readonly href: string | null }) {
  const className = buttonClass({ size: "small" });
  // الرابط غير المتاح معطَّل لا مخفي، فلا يقفز التخطيط
  if (href === null) {
    return (
      <span aria-disabled="true" className={className}>
        {label}
      </span>
    );
  }
  return (
    <Link href={href} prefetch={false} className={className}>
      {label}
    </Link>
  );
}

/** ترقيم الصفحات: المدى المعروض ورابطا السابق والتالي. */
export function Pagination({ label, range, previous, next, rangeTestId }: PaginationProps) {
  return (
    <nav aria-label={label} className={styles.pagination}>
      <p className={cx(styles.muted)} data-testid={rangeTestId}>
        {range}
      </p>
      <div className={styles.paginationLinks}>
        <PageLink {...previous} />
        <PageLink {...next} />
      </div>
    </nav>
  );
}
