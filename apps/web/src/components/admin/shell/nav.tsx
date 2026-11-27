"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, type ReactNode } from "react";
import { AdminIcon } from "../admin-icon";
import { isCurrentSection, type NavGroup, type NavKey } from "./nav-model";
import styles from "./sidebar.module.css";

interface AdminNavProps {
  /** اسم التنقل لقارئ الشاشة (يختلف بين الشريط الجانبي والدرج). */
  readonly label: string;
  readonly groups: readonly NavGroup[];
  /** عدّادات بعض الأقسام، مرسومة على الخادم؛ تصف الرابط ولا تدخل اسمه. */
  readonly counts?: Readonly<Partial<Record<NavKey, ReactNode>>>;
}

/** أقسام اللوحة المتاحة لهذا الموظف في مجموعاتها (تُحسب على الخادم من صلاحياته). */
export function AdminNav({ label, groups, counts = {} }: AdminNavProps) {
  const pathname = usePathname();
  const id = useId();
  return (
    <nav aria-label={label} className={styles.nav}>
      {groups.map((group) => (
        <div key={group.id} className={styles.group}>
          <p className={styles.groupLabel} id={`${id}-${group.id}`}>
            {group.label}
          </p>
          <ul className={styles.group} aria-labelledby={`${id}-${group.id}`}>
            {group.items.map((item) => {
              const count = counts[item.key];
              const countId = `${id}-count-${item.key}`;
              return (
                <li key={item.href} className={styles.item}>
                  <Link
                    href={item.href}
                    prefetch={false}
                    aria-current={isCurrentSection(pathname, item.href) ? "page" : undefined}
                    aria-describedby={count === undefined ? undefined : countId}
                    className={styles.navLink}
                  >
                    <AdminIcon name={item.icon} />
                    <span className={styles.navText}>{item.label}</span>
                  </Link>
                  {count === undefined ? null : <span id={countId}>{count}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
