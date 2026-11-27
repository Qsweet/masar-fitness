import type { StaffAccount } from "@masar/db";
import Link from "next/link";
import {
  ADMIN_ROUTES,
  ADMIN_SHORTCUTS_OFF,
  type AdminDensity,
  type AdminTheme,
} from "@/config/admin";
import type { AdminDictionary } from "@/i18n/admin";
import {
  setDensityAction,
  setShortcutsAction,
  setThemeAction,
} from "@/server/admin/actions/preferences";
import { logoutAction } from "@/server/admin/actions/session";
import { AdminIcon } from "../admin-icon";
import { MENU_ATTRIBUTE } from "./attributes";
import { MenuDismiss } from "./menu-dismiss";
import styles from "./menu.module.css";
import shellStyles from "./shell.module.css";

export interface DisplayPreferences {
  readonly theme: AdminTheme;
  readonly density: AdminDensity;
  readonly shortcuts: boolean;
}

interface UserMenuProps {
  readonly staff: StaffAccount;
  readonly preferences: DisplayPreferences;
  readonly dictionary: AdminDictionary;
}

function PreferenceForms({ preferences, dictionary }: Omit<UserMenuProps, "staff">) {
  const { userMenu, shell } = dictionary;
  const nextTheme: AdminTheme = preferences.theme === "dark" ? "light" : "dark";
  const compact = preferences.density === "compact";
  return (
    <>
      <form action={setDensityAction}>
        <input type="hidden" name="density" value={compact ? "comfortable" : "compact"} />
        <button type="submit" className={styles.menuItem}>
          <AdminIcon name="settings" />
          {compact ? shell.density.comfortable : shell.density.compact}
        </button>
      </form>
      <form action={setThemeAction}>
        <input type="hidden" name="theme" value={nextTheme} />
        <button type="submit" className={styles.menuItem}>
          <AdminIcon name={nextTheme === "light" ? "sun" : "moon"} />
          {userMenu.themes[nextTheme]}
        </button>
      </form>
      <form action={setShortcutsAction}>
        <input
          type="hidden"
          name="shortcuts"
          value={preferences.shortcuts ? ADMIN_SHORTCUTS_OFF : "on"}
        />
        <button type="submit" className={styles.menuItem}>
          <AdminIcon name="help" />
          {preferences.shortcuts ? shell.shortcutsToggle.off : shell.shortcutsToggle.on}
        </button>
      </form>
    </>
  );
}

/**
 * قائمة الحساب في الشريط العلوي (ADMIN_REDESIGN §4.2): من أنا ودوري، وحسابي، والكثافة والمظهر
 * والاختصارات، والخروج. ‎<details>‎ أصلي يعمل بلا JavaScript، وكل فعل نموذج بإجراء خادم.
 */
export function UserMenu({ staff, preferences, dictionary }: UserMenuProps) {
  const { nav, roles, userMenu } = dictionary;
  return (
    <details className={styles.menu} {...{ [MENU_ATTRIBUTE]: "" }}>
      <summary className={styles.menuButton}>
        <span className="sr-only">{userMenu.label}</span>
        <span className={styles.avatar} aria-hidden="true">
          {Array.from(staff.displayName)[0]}
        </span>
      </summary>
      <div className={styles.menuPanel}>
        <p className={styles.identity}>
          <span className={styles.identityName}>{staff.displayName}</span>
          <bdi className={styles.identityMeta} dir="ltr">
            {staff.email}
          </bdi>
          <span className={styles.identityMeta}>{roles[staff.role]}</span>
        </p>
        <Link href={ADMIN_ROUTES.account} prefetch={false} className={styles.menuItem}>
          <AdminIcon name="account" />
          {nav.account}
        </Link>
        <span className={styles.separator} />
        <PreferenceForms preferences={preferences} dictionary={dictionary} />
        <span className={styles.separator} />
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

/** تبديل المظهر بزر واحد في الشريط العلوي: نموذج بإجراء خادم، يعمل بلا JavaScript. */
export function ThemeToggle({
  theme,
  text,
}: {
  readonly theme: AdminTheme;
  readonly text: AdminDictionary["shell"]["theme"];
}) {
  const next: AdminTheme = theme === "dark" ? "light" : "dark";
  return (
    <form action={setThemeAction} className={shellStyles.desktopOnly}>
      <input type="hidden" name="theme" value={next} />
      <button
        type="submit"
        className={shellStyles.iconButton}
        aria-label={next === "light" ? text.toLight : text.toDark}
      >
        <AdminIcon name={next === "light" ? "sun" : "moon"} />
      </button>
    </form>
  );
}
