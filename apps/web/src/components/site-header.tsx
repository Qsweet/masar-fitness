import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { ROUTES } from "@/config/routes";
import type { Dictionary } from "@/i18n/dictionaries";
import { LOCALES, localizedPath, type Locale } from "@/i18n/locales";
import { cx } from "@/lib/cx";
import { MobileMenu } from "./mobile-menu";
import styles from "./site-header.module.css";

interface SiteHeaderProps {
  readonly locale: Locale;
  /** مسار الصفحة الحالية بلا بادئة لغة، ليقود تبديل اللغة إلى الصفحة نفسها. */
  readonly path: string;
  /** وجهة «اشترك الآن»: قسم الاشتراكات في الصفحة نفسها إن وُجد، وإلا صفحة الاشتراكات. */
  readonly joinHref: string;
  /** للمدونة مقال ظاهر بهذه اللغة */
  readonly showBlog: boolean;
  readonly dictionary: Dictionary;
}

const LOGO_HEIGHT = 48;

function otherLocale(locale: Locale): Locale {
  return LOCALES.find((candidate) => candidate !== locale) ?? locale;
}

function LanguageLink({
  locale,
  path,
  dictionary,
  className,
}: Pick<SiteHeaderProps, "locale" | "path" | "dictionary"> & {
  readonly className: string | undefined;
}) {
  const alternate = otherLocale(locale);
  return (
    <Link
      href={localizedPath(alternate, path)}
      hrefLang={alternate}
      lang={alternate}
      className={className}
    >
      {dictionary.nav.switchLanguage}
    </Link>
  );
}

function NavLinks({
  locale,
  showBlog,
  dictionary,
}: Pick<SiteHeaderProps, "locale" | "showBlog" | "dictionary">) {
  const home = localizedPath(locale);
  const links = [
    { href: localizedPath(locale, "/memberships"), label: dictionary.nav.memberships },
    { href: `${home}#train`, label: dictionary.nav.train },
    { href: `${home}#water`, label: dictionary.nav.water },
    { href: `${home}#location`, label: dictionary.nav.location },
    ...(showBlog ? [{ href: localizedPath(locale, ROUTES.blog), label: dictionary.blog.nav }] : []),
  ];
  return (
    <>
      {links.map((link) => (
        <Link key={link.href} href={link.href} className={styles.link}>
          {link.label}
        </Link>
      ))}
    </>
  );
}

/**
 * الترويسة السوداء: الشعار على خلفيته الداكنة كما صُمّم، وروابط نصية على الشاشات الواسعة،
 * وقائمة <details> على الجوال (تعمل بلا JavaScript) مع تبديل اللغة ظاهرًا بجانبها، وكتلة الاشتراك الصفراء دائمًا ظاهرة.
 */
export function SiteHeader({ locale, path, joinHref, showBlog, dictionary }: SiteHeaderProps) {
  return (
    <header className={styles.header}>
      <Link href={localizedPath(locale)} className={styles.brand}>
        <Logo height={LOGO_HEIGHT} alt={dictionary.club.logoAlt} preload />
      </Link>
      <nav aria-label={dictionary.nav.main} className={styles.nav}>
        <NavLinks locale={locale} showBlog={showBlog} dictionary={dictionary} />
        <LanguageLink locale={locale} path={path} dictionary={dictionary} className={styles.link} />
      </nav>
      <LanguageLink
        locale={locale}
        path={path}
        dictionary={dictionary}
        className={cx(styles.link, styles.languageMobile)}
      />
      <MobileMenu label={dictionary.nav.menu} className={styles.menu}>
        <nav aria-label={dictionary.nav.mobile} className={styles.menuPanel}>
          <NavLinks locale={locale} showBlog={showBlog} dictionary={dictionary} />
        </nav>
      </MobileMenu>
      <Link href={joinHref} className={styles.cta}>
        {dictionary.nav.join}
      </Link>
    </header>
  );
}
