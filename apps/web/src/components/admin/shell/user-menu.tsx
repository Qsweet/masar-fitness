import type { StaffAccount } from "@masar/db";
import Link from "next/link";
import { ADMIN_ROUTES, type AdminTheme } from "@/config/admin";
import type { AdminDictionary } from "@/i18n/admin";
import { setThemeAction } from "@/server/admin/actions/preferences";
import { logoutAction } from "@/server/admin/actions/session";
import { AdminIcon } from "../admin-icon";
import { MENU_ATTRIBUTE } from "./attributes";
import { MenuDismiss } from "./menu-dismiss";
import styles from "./shell.module.css";

interface UserMenuProps {
  readonly staff: StaffAccount;
  readonly theme: AdminTheme;
  readonly dictionary: AdminDictionary;
}

/**
 * قائمة المستخدم في الشريط العلوي: من أنا ودوري، وحسابي، وتبديل المظهر، والخروج. ‎<details>‎ أصلي
 * (يعمل بلا JavaScript)، وكل فعل نموذج بإجراء خادم.
 */
export function UserMenu({ staff, theme, dictionary }: UserMenuProps) {
  const { nav, roles, userMenu } = dictionary;
  const nextTheme: AdminTheme = theme === "dark" ? "light" : "dark";
  return (
    <details className={styles.menu} {...{ [MENU_ATTRIBUTE]: "" }}>
      <summary className={styles.menuButton}>
        <span className="sr-only">{userMenu.label}</span>
        <span className={styles.avatar} aria-hidden="true">
          {Array.from(staff.displayName)[0]}
        </span>
        <span className={styles.menuName}>{staff.displayName}</span>
        <AdminIcon name="chevron" size={14} />
      </summary>
      <div className={styles.menuPanel}>
        <p className={styles.menuIdentity}>
          <span className={styles.menuIdentityName}>{staff.displayName}</span>
          <bdi className={styles.menuIdentityMeta} dir="ltr">
            {staff.email}
          </bdi>
          <span className={styles.menuIdentityMeta}>{roles[staff.role]}</span>
        </p>
        <Link href={ADMIN_ROUTES.account} prefetch={false} className={styles.menuItem}>
          <AdminIcon name="account" />
          {nav.account}
        </Link>
        <form action={setThemeAction}>
          <input type="hidden" name="theme" value={nextTheme} />
          <button type="submit" className={styles.menuItem}>
            <AdminIcon name={nextTheme === "light" ? "sun" : "moon"} />
            {userMenu.themes[nextTheme]}
          </button>
        </form>
        <form action={logoutAction}>
          <button type="submit" className={styles.menuItem}>
            <AdminIcon name="logout" />
            {nav.logout}
          </button>
        </form>
      </div>
      <MenuDismiss />
    </details>
  );
}
