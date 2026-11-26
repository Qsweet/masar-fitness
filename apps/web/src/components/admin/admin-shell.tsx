import { hasPermission, type Permission } from "@masar/domain";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui/logo";
import { ADMIN_ROUTES } from "@/config/admin";
import type { AdminDictionary } from "@/i18n/admin";
import { logoutAction } from "@/server/admin/actions/session";
import type { StaffContext } from "@/server/admin/session";
import { AdminIcon, type AdminIconName } from "./admin-icon";
import { AdminNav, type AdminNavItem } from "./admin-nav";
import styles from "./shell.module.css";

export const ADMIN_MAIN_ID = "admin-main";

interface Section {
  readonly href: string;
  readonly key: "overview" | "staff" | "audit" | "account";
  readonly icon: AdminIconName;
  readonly permission: Permission;
}

/** الأقسام المبنية فقط، كلٌّ بصلاحيته: ما لا يملكه الموظف لا يظهر له (والصفحة نفسها ترفضه). */
const SECTIONS: readonly Section[] = [
  { href: ADMIN_ROUTES.home, key: "overview", icon: "overview", permission: "overview.read" },
  { href: ADMIN_ROUTES.staff, key: "staff", icon: "staff", permission: "staff.manage" },
  { href: ADMIN_ROUTES.audit, key: "audit", icon: "audit", permission: "audit.read" },
  { href: ADMIN_ROUTES.account, key: "account", icon: "account", permission: "account.self" },
];

interface AdminShellProps {
  readonly context: StaffContext;
  readonly dictionary: AdminDictionary;
  readonly children: ReactNode;
}

export function AdminShell({ context, dictionary, children }: AdminShellProps) {
  const { staff } = context;
  const items: AdminNavItem[] = SECTIONS.filter((section) =>
    hasPermission(staff.role, section.permission),
  ).map((section) => ({
    href: section.href,
    label: dictionary.nav[section.key],
    icon: section.icon,
  }));
  return (
    <div className={styles.shell}>
      <header className={styles.sidebar}>
        <Link
          href={items[0]?.href ?? ADMIN_ROUTES.account}
          prefetch={false}
          className={styles.brand}
        >
          <Logo variant="lockup" height="2.25rem" alt={dictionary.brand.logoAlt} preload />
          <span className={styles.brandName}>{dictionary.brand.name}</span>
        </Link>
        <AdminNav label={dictionary.nav.label} items={items} />
        <div className={styles.user}>
          <p className={styles.userText}>
            <span className={styles.userName}>{staff.displayName}</span>
            <span className={styles.userRole}>{dictionary.roles[staff.role]}</span>
          </p>
          <form action={logoutAction}>
            <button type="submit" className={styles.logout}>
              <AdminIcon name="logout" />
              {dictionary.nav.logout}
            </button>
          </form>
        </div>
      </header>
      <main id={ADMIN_MAIN_ID} tabIndex={-1} className={styles.main}>
        {children}
      </main>
    </div>
  );
}
