"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { breadcrumbTrail } from "./nav-model";
import styles from "./shell.module.css";

interface BreadcrumbsProps {
  readonly label: string;
  /** أسماء المسارات المعروفة (من القاموس، تُحسب على الخادم). */
  readonly labels: Readonly<Record<string, string>>;
  readonly detailLabel: string;
}

/** مسار التنقل في الشريط العلوي: أين أنا، وطريق العودة. على الهاتف تظهر الحلقة الأخيرة وحدها. */
export function Breadcrumbs({ label, labels, detailLabel }: BreadcrumbsProps) {
  const trail = breadcrumbTrail(usePathname(), labels, detailLabel);
  return (
    <nav aria-label={label}>
      <ol className={styles.crumbs}>
        {trail.map((crumb, index) => (
          <li key={crumb.href}>
            {index === trail.length - 1 ? (
              <span aria-current="page" className={styles.crumb}>
                {crumb.label}
              </span>
            ) : (
              <Link href={crumb.href} prefetch={false} className={styles.crumb}>
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
