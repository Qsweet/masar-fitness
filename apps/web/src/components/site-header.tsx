import Link from "next/link";
import { CartLink, type CartLinkView } from "@/components/cart/cart-link";
import { Icon } from "@/components/ui/icon";
import { Logo } from "@/components/ui/logo";
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
  /** رابط السلة وعددها؛ null والشراء الإلكتروني مغلق (لا رابط إلى صفحة 404) */
  readonly cart: CartLinkView | null;
  readonly dictionary: Dictionary;
}

function otherLocale(locale: Locale): Locale {
  return LOCALES.find((candidate) => candidate !== locale) ?? locale;
}

/** روابط التنقل بترتيب تصميم المالك: الرئيسية، العضويات، المرافق، البرامج، المدونة، تواصل. */
type NavProps = Pick<SiteHeaderProps, "locale" | "showBlog" | "dictionary">;

function navLinks({ locale, showBlog, dictionary }: NavProps) {
  const home = localizedPath(locale);
  const { nav } = dictionary;
  return [
    { href: home, label: nav.home },
    { href: localizedPath(locale, ROUTES.memberships), label: nav.memberships },
    { href: `${home}#facilities`, label: nav.facilities },
    { href: `${home}#services`, label: nav.services },
    ...(showBlog ? [{ href: localizedPath(locale, ROUTES.blog), label: dictionary.blog.nav }] : []),
    { href: `${home}#contact`, label: nav.contact },
  ];
}

function NavLinks(props: NavProps) {
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
 * الترويسة الثابتة: شفافة فوق الواجهة ثم سوداء زجاجية مع التمرير. الشعار الرسمي الأفقي في البداية،
 * والروابط النصية في الوسط على الشاشة الواسعة، وتبديل اللغة وزر «اشترك الآن» الأصفر في النهاية.
 * على الجوال قائمة <details> تعمل بلا JavaScript.
 */
export function SiteHeader(props: SiteHeaderProps) {
  const { locale, path, joinHref, showBlog, cart, dictionary } = props;
  const alternate = otherLocale(locale);
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href={localizedPath(locale)} className={styles.brand}>
          <Logo
            variant="lockup"
            height="var(--logo-height)"
            alt={dictionary.club.logoAlt}
            preload
          />
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
          {cart === null ? null : <CartLink {...cart} />}
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
