import Link from "next/link";
import { ADMIN_ROUTES, AUDIT_PAGE_SIZE } from "@/config/admin";
import type { AdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { formatNumber } from "@/i18n/format";
import { cx } from "@/lib/cx";
import { adminButton } from "./fields";
import styles from "./page.module.css";

interface AuditPagerProps {
  readonly text: AdminDictionary["audit"];
  readonly page: number;
  /** عدد الصفوف المعروضة في هذه الصفحة. */
  readonly shown: number;
  readonly total: number;
  readonly filters: Readonly<Record<string, string | undefined>>;
}

function pageHref(page: number, filters: AuditPagerProps["filters"]): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined) {
      query.set(key, value);
    }
  }
  if (page > 1) {
    query.set("page", String(page));
  }
  const search = query.toString();
  return search === "" ? ADMIN_ROUTES.audit : `${ADMIN_ROUTES.audit}?${search}`;
}

/** «1 إلى 25 من 310» ورابطا الأحدث والأقدم؛ الرابط غير المتاح معطَّل لا مخفي، فلا يقفز التخطيط. */
export function AuditPager({ text, page, shown, total, filters }: AuditPagerProps) {
  if (total === 0) {
    return null;
  }
  const from = (page - 1) * AUDIT_PAGE_SIZE + 1;
  const range = fill(text.range, {
    from: formatNumber(shown === 0 ? 0 : from),
    to: formatNumber(shown === 0 ? 0 : from + shown - 1),
    total: formatNumber(total),
  });
  const hasOlder = page * AUDIT_PAGE_SIZE < total;
  const link = (enabled: boolean) => cx(adminButton("outline"), !enabled && styles.disabledLink);
  return (
    <nav aria-label={text.pagination} className={styles.pager}>
      <p className={styles.muted} data-testid="audit-range">
        {range}
      </p>
      <div className={styles.pagerLinks}>
        <Link
          href={pageHref(page - 1, filters)}
          prefetch={false}
          aria-disabled={page <= 1}
          tabIndex={page <= 1 ? -1 : undefined}
          className={link(page > 1)}
        >
          {text.newer}
        </Link>
        <Link
          href={pageHref(page + 1, filters)}
          prefetch={false}
          aria-disabled={!hasOlder}
          tabIndex={hasOlder ? undefined : -1}
          className={link(hasOlder)}
        >
          {text.older}
        </Link>
      </div>
    </nav>
  );
}
