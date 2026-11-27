import type { ReactNode } from "react";
import { ADMIN_ROUTES } from "@/config/admin";
import type { AdminDictionary } from "@/i18n/admin";
import { cx } from "@/lib/cx";
import type { StaffContext } from "@/server/admin/session";
import type { EnvironmentBadge } from "@/server/admin/system-status";
import { AdminIcon } from "../admin-icon";
import { ADMIN_MAIN_ID } from "../main-id";
import { SHELL_ATTRIBUTE } from "./attributes";
import { Breadcrumbs } from "./breadcrumbs";
import { commandEntriesFor } from "./command-model";
import { CommandTrigger } from "./command-trigger";
import { crumbLabels } from "./crumb-labels";
import drawerStyles from "./drawer.module.css";
import { MobileDrawer } from "./mobile-drawer";
import { AdminNav } from "./nav";
import { navCounts } from "./nav-counts";
import { navGroupsFor, PERSONAL_GROUP, type NavGroup } from "./nav-model";
import { ShellCommands } from "./shell-commands";
import styles from "./shell.module.css";
import { ClubHead, HelpLink, Sidebar } from "./sidebar";
import { chordTargets } from "./shortcuts";
import { ThemeToggle, UserMenu, type DisplayPreferences } from "./user-menu";

interface AdminShellProps {
  readonly context: StaffContext;
  readonly clubName: string;
  readonly dictionary: AdminDictionary;
  /** حالة الشريط الجانبي من كوكي التفضيل. */
  readonly collapsed: boolean;
  readonly preferences: DisplayPreferences;
  readonly environment: EnvironmentBadge;
  readonly children: ReactNode;
}

/** الصفحة الأولى المتاحة للموظف: وجهة الشعار. */
function homeOf(groups: readonly NavGroup[]): string {
  return groups[0]?.items[0]?.href ?? ADMIN_ROUTES.account;
}

function SearchBar({ text }: { readonly text: AdminDictionary["shell"] }) {
  return (
    <CommandTrigger
      command="palette"
      href={ADMIN_ROUTES.search}
      className={cx(styles.searchBar, styles.desktopOnly)}
    >
      <AdminIcon name="search" size={16} />
      <span className={styles.searchText}>{text.search}</span>
      <span className={styles.keys} aria-hidden="true">
        <kbd className={styles.kbd}>⌘</kbd>
        <kbd className={styles.kbd}>K</kbd>
      </span>
    </CommandTrigger>
  );
}

interface TopbarProps extends Omit<AdminShellProps, "children" | "collapsed" | "clubName"> {
  readonly drawer: ReactNode;
}

/** الشريط العلوي (§4.2): مسار التنقل، والبحث، وشارة البيئة، والموقع، والمظهر، وقائمة الحساب. */
function Topbar({ context, dictionary, preferences, environment, drawer }: TopbarProps) {
  const { nav, shell, breadcrumbs } = dictionary;
  return (
    <header className={styles.topbar}>
      {drawer}
      <Breadcrumbs
        label={breadcrumbs.label}
        labels={crumbLabels(dictionary)}
        detailLabel={breadcrumbs.detail}
      />
      <SearchBar text={shell} />
      <div className={styles.topActions}>
        <CommandTrigger
          command="palette"
          href={ADMIN_ROUTES.search}
          className={cx(styles.iconButton, styles.mobileOnly)}
          label={shell.searchShort}
        >
          <AdminIcon name="search" />
        </CommandTrigger>
        {environment === null ? null : (
          <span className={styles.envBadge}>{shell.environment[environment]}</span>
        )}
        <a
          href="/"
          target="_blank"
          rel="noopener"
          className={styles.iconButton}
          aria-label={`${nav.viewSite} ${shell.newTab}`}
        >
          <AdminIcon name="external" />
        </a>
        <ThemeToggle theme={preferences.theme} text={shell.theme} />
        <span className={styles.divider} aria-hidden="true" />
        <UserMenu staff={context.staff} preferences={preferences} dictionary={dictionary} />
      </div>
    </header>
  );
}

/**
 * هيكل اللوحة v2 (ADMIN_REDESIGN §4): الشريط الجانبي، والشريط العلوي، والدرج على الهاتف، وطبقة الأوامر
 * (⌘K والاختصارات). كل ما يُعرض محسوب هنا على الخادم بصلاحيات الموظف؛ المتصفح يحسّن ولا يقرر.
 */
export function AdminShell(props: AdminShellProps) {
  const { context, clubName, dictionary, collapsed, preferences, children } = props;
  const { role, clubId } = context.staff;
  const { nav, shell } = dictionary;
  const groups = navGroupsFor(role, dictionary);
  const sidebarGroups = groups.filter((group) => group.id !== PERSONAL_GROUP);
  const counts = navCounts(role, clubId, shell.counts);
  const head = <ClubHead home={homeOf(groups)} clubName={clubName} dictionary={dictionary} />;
  const drawer = (
    <MobileDrawer
      labels={{ open: shell.openMenu, close: shell.closeMenu, title: nav.label }}
      brand={head}
    >
      <div className={drawerStyles.drawerSearch}>
        <CommandTrigger
          command="palette"
          href={ADMIN_ROUTES.search}
          className={cx(styles.searchBar, styles.searchFull)}
        >
          <AdminIcon name="search" size={16} />
          <span className={styles.searchText}>{shell.search}</span>
        </CommandTrigger>
      </div>
      <AdminNav label={shell.drawerNav} groups={groups} counts={counts} />
      <HelpLink text={shell} />
    </MobileDrawer>
  );
  return (
    <div
      className={styles.shell}
      {...{ [SHELL_ATTRIBUTE]: "" }}
      data-collapsed={collapsed ? "" : undefined}
    >
      <Sidebar
        head={head}
        groups={sidebarGroups}
        counts={counts}
        collapsed={collapsed}
        dictionary={dictionary}
      />
      <div className={styles.column}>
        <Topbar {...props} drawer={drawer} />
        <main id={ADMIN_MAIN_ID} tabIndex={-1} className={styles.main}>
          {children}
        </main>
      </div>
      <ShellCommands
        entries={commandEntriesFor(role, dictionary)}
        targets={chordTargets(groups.flatMap((group) => group.items))}
        shortcutsEnabled={preferences.shortcuts}
        text={shell}
      />
    </div>
  );
}
