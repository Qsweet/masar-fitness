import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import mark from "@/app/icon.png";
import { Logo } from "@/components/ui/logo";
import { ADMIN_ROUTES } from "@/config/admin";
import type { AdminDictionary } from "@/i18n/admin";
import { cx } from "@/lib/cx";
import { AdminIcon } from "../admin-icon";
import { CommandTrigger } from "./command-trigger";
import { AdminNav } from "./nav";
import type { NavGroup, NavKey } from "./nav-model";
import shellStyles from "./shell.module.css";
import styles from "./sidebar.module.css";
import { SidebarToggle } from "./sidebar-toggle";

/** رابط قسم الاختصارات في صفحة البحث: وجهة زر المساعدة بلا JavaScript. */
export const SHORTCUTS_ANCHOR = `${ADMIN_ROUTES.search}#shortcuts`;

interface ClubHeadProps {
  readonly home: string;
  readonly clubName: string;
  readonly dictionary: AdminDictionary;
}

/**
 * رأس الشريط: شعار النادي واسمه. بنادٍ واحد اسم لا قائمة (ADMIN_REDESIGN §4.1، §12-6): لا مبدّل
 * أندية قبل قرار المالك ونموذج عضوية متعدد.
 */
export function ClubHead({ home, clubName, dictionary }: ClubHeadProps) {
  return (
    <div className={styles.head}>
      <Link
        href={home}
        prefetch={false}
        className={styles.brand}
        aria-label={dictionary.brand.name}
      >
        <span className={styles.brandFull}>
          <Logo variant="lockup" height="1.875rem" alt="" preload />
        </span>
        <Image src={mark} alt="" className={styles.brandMark} />
      </Link>
      <p className={styles.club}>
        <span className="sr-only">{dictionary.shell.clubLabel}: </span>
        {clubName}
      </p>
    </div>
  );
}

export function HelpLink({ text }: { readonly text: AdminDictionary["shell"] }) {
  return (
    <CommandTrigger command="help" href={SHORTCUTS_ANCHOR} className={styles.footButton}>
      <AdminIcon name="help" />
      <span className={styles.navText}>{text.help}</span>
      <kbd className={cx(shellStyles.kbd, styles.footKey)} aria-hidden="true">
        ?
      </kbd>
    </CommandTrigger>
  );
}

interface SidebarProps {
  readonly head: ReactNode;
  readonly groups: readonly NavGroup[];
  readonly counts: Readonly<Partial<Record<NavKey, ReactNode>>>;
  readonly collapsed: boolean;
  readonly dictionary: AdminDictionary;
}

/** الشريط الجانبي على الشاشة الواسعة: النادي، ثم الأقسام بعدّاداتها، ثم المساعدة والطي. */
export function Sidebar({ head, groups, counts, collapsed, dictionary }: SidebarProps) {
  const { nav, shell } = dictionary;
  return (
    <aside className={styles.sidebar} data-surface="dark">
      {head}
      <div className={styles.scroll}>
        <AdminNav label={nav.label} groups={groups} counts={counts} />
      </div>
      <div className={styles.foot}>
        <HelpLink text={shell} />
        <SidebarToggle
          initiallyCollapsed={collapsed}
          labels={{ collapse: shell.collapse, expand: shell.expand }}
        />
      </div>
    </aside>
  );
}
