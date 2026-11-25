import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/icon";
import { ROUTES } from "@/config/routes";
import type { Dictionary } from "@/i18n/dictionaries";
import { localizedPath, type Locale } from "@/i18n/locales";
import { cx } from "@/lib/cx";
import styles from "./tab-bar.module.css";

interface TabBarProps {
  readonly locale: Locale;
  /** مسار الصفحة الحالية بلا بادئة لغة: يحدد التبويب النشط */
  readonly path: string;
  readonly showBlog: boolean;
  readonly whatsappHref: string;
  readonly dictionary: Dictionary;
}

interface Tab {
  readonly key: string;
  readonly href: string;
  readonly icon: IconName;
  readonly label: string;
  /** المسار الذي يجعله نشطًا (هو أو ما تحته)؛ غائب لما لا صفحة له */
  readonly section?: string;
  readonly external?: boolean;
}

function tabs({ locale, showBlog, whatsappHref, dictionary }: Omit<TabBarProps, "path">): Tab[] {
  const { tabs: labels } = dictionary;
  const home = localizedPath(locale);
  return [
    { key: "home", href: home, icon: "home", label: labels.home, section: ROUTES.home },
    {
      key: "memberships",
      href: localizedPath(locale, ROUTES.memberships),
      icon: "award",
      label: labels.memberships,
      section: ROUTES.memberships,
    },
    { key: "services", href: `${home}#services`, icon: "grid", label: labels.services },
    ...(showBlog
      ? [
          {
            key: "blog",
            href: localizedPath(locale, ROUTES.blog),
            icon: "book" as const,
            label: labels.blog,
            section: ROUTES.blog,
          },
        ]
      : []),
    { key: "whatsapp", href: whatsappHref, icon: "chat", label: labels.whatsapp, external: true },
  ];
}

function isActive(tab: Tab, path: string): boolean {
  if (tab.section === undefined) {
    return false;
  }
  return tab.section === ROUTES.home
    ? path === ROUTES.home
    : path === tab.section || path.startsWith(`${tab.section}/`);
}

/**
 * شريط التبويب السفلي على الهاتف كتطبيق: الرئيسية والعضويات والخدمات والمدونة وواتساب، والتبويب
 * النشط بالأصفر (aria-current). لا «سلة» ولا «حسابي» قبل وجودهما فعلًا. يعمل بلا JavaScript.
 */
export function TabBar(props: TabBarProps) {
  return (
    <nav aria-label={props.dictionary.tabs.label} className={styles.bar}>
      <ul className={styles.list}>
        {tabs(props).map((tab) => {
          const active = isActive(tab, props.path);
          const content = (
            <>
              <Icon name={tab.icon} />
              <span>{tab.label}</span>
            </>
          );
          return (
            <li key={tab.key}>
              {tab.external === true ? (
                <a href={tab.href} rel="noopener noreferrer" className={styles.tab}>
                  {content}
                </a>
              ) : (
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(styles.tab, active && styles.active)}
                >
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
