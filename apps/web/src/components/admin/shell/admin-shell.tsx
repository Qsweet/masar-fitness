import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import mark from "@/app/icon.png";
import { Logo } from "@/components/ui/logo";
import {
  ADMIN_ROUTES,
  customerPath,
  orderCancelPath,
  orderPath,
  orderSettlePath,
  planPath,
  planStatusPath,
  promotionPath,
  promotionStatusPath,
  staffMemberPath,
  contentNamespacePath,
  releasePath,
  releaseRollbackPath,
  type AdminTheme,
} from "@/config/admin";
import type { AdminDictionary } from "@/i18n/admin";
import { cx } from "@/lib/cx";
import type { StaffContext } from "@/server/admin/session";
import { AdminIcon } from "../admin-icon";
import { ADMIN_MAIN_ID } from "../main-id";
import { SHELL_ATTRIBUTE } from "./attributes";
import { Breadcrumbs } from "./breadcrumbs";
import { MobileDrawer } from "./mobile-drawer";
import { AdminNav } from "./nav";
import { navGroupsFor } from "./nav-model";
import styles from "./shell.module.css";
import { SidebarToggle } from "./sidebar-toggle";
import { UserMenu } from "./user-menu";

interface AdminShellProps {
  readonly context: StaffContext;
  readonly dictionary: AdminDictionary;
  /** حالة الشريط الجانبي من كوكي التفضيل. */
  readonly collapsed: boolean;
  readonly theme: AdminTheme;
  readonly children: ReactNode;
}

/** الصفحة الأولى المتاحة للموظف: وجهة الشعار. */
function homeOf(groups: ReturnType<typeof navGroupsFor>): string {
  return groups[0]?.items[0]?.href ?? ADMIN_ROUTES.account;
}

function Brand({
  href,
  dictionary,
}: {
  readonly href: string;
  readonly dictionary: AdminDictionary;
}) {
  return (
    <Link href={href} prefetch={false} className={styles.brand} aria-label={dictionary.brand.name}>
      <span className={styles.brandFull}>
        <Logo variant="lockup" height="1.75rem" alt="" preload />
      </span>
      <Image src={mark} alt="" className={styles.brandMark} />
    </Link>
  );
}

/** أسماء المسارات لمسار التنقل، من القاموس. */
function crumbLabels(dictionary: AdminDictionary): Record<string, string> {
  const { nav, staffNew, breadcrumbs, sales, content } = dictionary;
  const namespaces = Object.entries(content.namespaces).map(
    ([namespace, label]): [string, string] => [contentNamespacePath(namespace), label],
  );
  return {
    ...Object.fromEntries(namespaces),
    [ADMIN_ROUTES.home]: breadcrumbs.root,
    [ADMIN_ROUTES.staff]: nav.staff,
    [ADMIN_ROUTES.staffNew]: staffNew.title,
    [staffMemberPath("*")]: breadcrumbs.staffMember,
    [ADMIN_ROUTES.audit]: nav.audit,
    [ADMIN_ROUTES.account]: nav.account,
    [ADMIN_ROUTES.sales]: sales.breadcrumbs.group,
    [ADMIN_ROUTES.orders]: nav.orders,
    [orderPath("*")]: sales.breadcrumbs.order,
    [orderCancelPath("*")]: sales.breadcrumbs.cancel,
    [orderSettlePath("*")]: sales.breadcrumbs.settle,
    [ADMIN_ROUTES.customers]: nav.customers,
    [customerPath("*")]: sales.breadcrumbs.customer,
    [ADMIN_ROUTES.plans]: nav.plans,
    [ADMIN_ROUTES.plansNew]: sales.breadcrumbs.planNew,
    [planPath("*")]: sales.breadcrumbs.plan,
    [planStatusPath("*")]: sales.breadcrumbs.planStatus,
    [ADMIN_ROUTES.promotions]: nav.promotions,
    [ADMIN_ROUTES.promotionsNew]: sales.breadcrumbs.promotionNew,
    [promotionPath("*")]: sales.breadcrumbs.promotion,
    [promotionStatusPath("*")]: sales.breadcrumbs.promotionStatus,
    [ADMIN_ROUTES.salesSettings]: nav.salesSettings,
    [ADMIN_ROUTES.content]: content.breadcrumbs.group,
    [ADMIN_ROUTES.contentTexts]: nav.contentTexts,
    [ADMIN_ROUTES.contentPublish]: content.breadcrumbs.publish,
    [ADMIN_ROUTES.contentHistory]: content.breadcrumbs.history,
    [ADMIN_ROUTES.contentDiscard]: content.breadcrumbs.discard,
    [releasePath("*")]: content.breadcrumbs.release,
    [releaseRollbackPath("*")]: content.breadcrumbs.rollback,
  };
}

export function AdminShell({ context, dictionary, collapsed, theme, children }: AdminShellProps) {
  const { nav, shell, breadcrumbs } = dictionary;
  const groups = navGroupsFor(context.staff.role, dictionary);
  const brand = <Brand href={homeOf(groups)} dictionary={dictionary} />;
  return (
    <div
      className={styles.shell}
      {...{ [SHELL_ATTRIBUTE]: "" }}
      data-collapsed={collapsed ? "" : undefined}
    >
      <aside className={styles.sidebar} data-surface="dark">
        {brand}
        <AdminNav label={nav.label} groups={groups} />
        <div className={styles.sidebarFoot}>
          <SidebarToggle
            initiallyCollapsed={collapsed}
            labels={{ collapse: shell.collapse, expand: shell.expand }}
          />
        </div>
      </aside>
      <div className={styles.column}>
        <header className={styles.topbar}>
          <MobileDrawer
            labels={{ open: shell.openMenu, close: shell.closeMenu, title: nav.label }}
            brand={brand}
          >
            <AdminNav label={shell.drawerNav} groups={groups} />
          </MobileDrawer>
          <Breadcrumbs
            label={breadcrumbs.label}
            labels={crumbLabels(dictionary)}
            detailLabel={breadcrumbs.detail}
          />
          <div className={styles.topActions}>
            <a
              href="/"
              target="_blank"
              rel="noopener"
              className={styles.topLink}
              aria-label={`${nav.viewSite} ${shell.newTab}`}
            >
              <span className={styles.topLinkText}>{nav.viewSite}</span>
              <AdminIcon name="external" size={16} />
            </a>
            <UserMenu staff={context.staff} theme={theme} dictionary={dictionary} />
          </div>
        </header>
        <main id={ADMIN_MAIN_ID} tabIndex={-1} className={cx(styles.main)}>
          {children}
        </main>
      </div>
    </div>
  );
}
