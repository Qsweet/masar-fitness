import Link from "next/link";
import { BrandMark } from "@/components/ui/brand-mark";
import { Icon } from "@/components/ui/icon";
import { ROUTES } from "@/config/routes";
import type { Dictionary } from "@/i18n/dictionaries";
import { LOCALES, localizedPath, type Locale } from "@/i18n/locales";
import { MobileMenu } from "./mobile-menu";
import styles from "./site-header.module.css";

interface SiteHeaderProps {
  readonly locale: Locale;
  /** مسار الصفحة الحالية بلا بادئة لغة، ليقود تبديل اللغة إلى الصفحة نفسها. */
  readonly path: string;
  /** وجهة «اشترك»: قسم الاشتراكات في الصفحة نفسها إن وُجد، وإلا صفحة الاشتراكات. */
  readonly joinHref: string;
  /** للمدونة مقال ظاهر بهذه اللغة */
  readonly showBlog: boolean;
  readonly dictionary: Dictionary;
}

function otherLocale(locale: Locale): Locale {
  return LOCALES.find((candidate) => candidate !== locale) ?? locale;
}

/** روابط التنقل: أقسام الرئيسية بمراسيها، وصفحتا الاشتراكات والمدونة. */
function navLinks({ locale, showBlog, dictionary }: Omit<SiteHeaderProps, "path" | "joinHref">) {
  const home = localizedPath(locale);
  const { nav } = dictionary;
  return [
    { href: `${home}#about`, label: nav.about },
    { href: `${home}#facilities`, label: nav.facilities },
    { href: localizedPath(locale, ROUTES.memberships), label: nav.memberships },
    { href: `${home}#services`, label: nav.services },
    ...(showBlog ? [{ href: localizedPath(locale, ROUTES.blog), label: dictionary.blog.nav }] : []),
    { href: `${home}#contact`, label: nav.contact },
  ];
}

function NavLinks(props: Omit<SiteHeaderProps, "path" | "joinHref">) {
  return (
    <>
      {navLinks(props).map((link) => (
        <Link key={link.href} href={link.href} className={styles.link}>
          {link.label}
        </Link>
      ))}
    </>
  );
}

/**
 * الترويسة الفاتحة الثابتة: مربع الشعار والاسم في البداية، والروابط النصية في الوسط على الشاشة الواسعة،
 * وتبديل اللغة وزر «اشترك الآن» بالتدرّج في النهاية. على الجوال قائمة <details> تعمل بلا JavaScript.
 */
export function SiteHeader({ locale, path, joinHref, showBlog, dictionary }: SiteHeaderProps) {
  const alternate = otherLocale(locale);
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href={localizedPath(locale)} className={styles.brand}>
          <BrandMark dictionary={dictionary} preload />
        </Link>
        <nav aria-label={dictionary.nav.main} className={styles.nav}>
          <NavLinks locale={locale} showBlog={showBlog} dictionary={dictionary} />
        </nav>
        <div className={styles.actions}>
          <Link
            href={localizedPath(alternate, path)}
            hrefLang={alternate}
            lang={alternate}
            className={styles.language}
          >
            {dictionary.nav.switchLanguage}
          </Link>
          <Link href={joinHref} className={styles.cta}>
            {dictionary.nav.join}
          </Link>
          <MobileMenu
            label={dictionary.nav.menu}
            icon={<Icon name="menu" />}
            className={styles.menu}
          >
            <nav aria-label={dictionary.nav.mobile} className={styles.menuPanel}>
              <NavLinks locale={locale} showBlog={showBlog} dictionary={dictionary} />
            </nav>
          </MobileMenu>
        </div>
      </div>
    </header>
  );
}
