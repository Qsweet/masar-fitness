"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId } from "react";
import { AdminIcon } from "../admin-icon";
import { isCurrentSection, type NavGroup } from "./nav-model";
import styles from "./shell.module.css";

interface AdminNavProps {
  /** اسم التنقل لقارئ الشاشة (يختلف بين الشريط الجانبي والدرج). */
  readonly label: string;
  readonly groups: readonly NavGroup[];
}

/** أقسام اللوحة المتاحة لهذا الموظف في مجموعاتها (تُحسب على الخادم من صلاحياته). */
export function AdminNav({ label, groups }: AdminNavProps) {
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
            {group.items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  prefetch={false}
                  aria-current={isCurrentSection(pathname, item.href) ? "page" : undefined}
                  className={styles.navLink}
                >
                  <AdminIcon name={item.icon} />
                  <span className={styles.navText}>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
