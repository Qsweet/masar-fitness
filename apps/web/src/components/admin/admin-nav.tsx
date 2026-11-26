"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_ROUTES } from "@/config/admin";
import { AdminIcon, type AdminIconName } from "./admin-icon";
import styles from "./shell.module.css";

export interface AdminNavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: AdminIconName;
}

/** القسم الحالي: الرئيسية بمطابقة تامة، وغيرها ببادئة المسار (صفحة موظف داخل «الموظفون»). */
function isCurrent(pathname: string, href: string): boolean {
  return href === ADMIN_ROUTES.home ? pathname === href : pathname.startsWith(href);
}

/** أقسام اللوحة المتاحة لهذا الموظف (تُحسب على الخادم من صلاحياته). */
export function AdminNav({ label, items }: { label: string; items: readonly AdminNavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className={styles.nav}>
      <ul className={styles.navList}>
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              prefetch={false}
              aria-current={isCurrent(pathname, item.href) ? "page" : undefined}
              className={styles.navLink}
            >
              <AdminIcon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
