import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import type { Dictionary } from "@/i18n/dictionaries";
import { LOCALES, localizedPath, type Locale } from "@/i18n/locales";
import styles from "./site-header.module.css";

interface SiteHeaderProps {
  readonly locale: Locale;
  /** مسار الصفحة الحالية بلا بادئة لغة، ليقود تبديل اللغة إلى الصفحة نفسها. */
  readonly path: string;
  /** وجهة «اشترك الآن»: قسم الاشتراكات في الصفحة نفسها إن وُجد، وإلا صفحة الاشتراكات. */
  readonly joinHref: string;
  readonly dictionary: Dictionary;
}

const LOGO_HEIGHT = 48;

function otherLocale(locale: Locale): Locale {
  return LOCALES.find((candidate) => candidate !== locale) ?? locale;
}

function NavLinks({ locale, path, dictionary }: Omit<SiteHeaderProps, "joinHref">) {
  const home = localizedPath(locale);
  const alternate = otherLocale(locale);
  const links = [
    { href: localizedPath(locale, "/memberships"), label: dictionary.nav.memberships },
    { href: `${home}#train`, label: dictionary.nav.train },
    { href: `${home}#water`, label: dictionary.nav.water },
    { href: `${home}#location`, label: dictionary.nav.location },
  ];
  return (
    <>
      {links.map((link) => (
        <Link key={link.href} href={link.href} className={styles.link}>
          {link.label}
        </Link>
      ))}
      <Link
        href={localizedPath(alternate, path)}
        hrefLang={alternate}
        lang={alternate}
        className={styles.link}
      >
        {dictionary.nav.switchLanguage}
      </Link>
    </>
  );
}

/**
 * الترويسة السوداء: الشعار على خلفيته الداكنة كما صُمّم، وروابط نصية على الشاشات الواسعة،
 * وقائمة <details> على الجوال (تعمل بلا JavaScript)، وكتلة الاشتراك الصفراء دائمًا ظاهرة.
 */
export function SiteHeader({ locale, path, joinHref, dictionary }: SiteHeaderProps) {
  return (
    <header className={styles.header}>
      <Link href={localizedPath(locale)} className={styles.brand}>
        <Logo height={LOGO_HEIGHT} alt={dictionary.club.logoAlt} preload />
      </Link>
      <nav aria-label={dictionary.nav.main} className={styles.nav}>
        <NavLinks locale={locale} path={path} dictionary={dictionary} />
      </nav>
      <details className={styles.menu}>
        <summary>{dictionary.nav.menu}</summary>
        <nav aria-label={dictionary.nav.mobile} className={styles.menuPanel}>
          <NavLinks locale={locale} path={path} dictionary={dictionary} />
        </nav>
      </details>
      <Link href={joinHref} className={styles.cta}>
        {dictionary.nav.join}
      </Link>
    </header>
  );
}
