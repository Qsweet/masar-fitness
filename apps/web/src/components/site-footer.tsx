import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { CLUB_CONTACT, whatsappUrl } from "@/config/club";
import { ROUTES } from "@/config/routes";
import type { Dictionary } from "@/i18n/dictionaries";
import { localizedPath, type Locale } from "@/i18n/locales";
import { cx } from "@/lib/cx";
import styles from "./site-footer.module.css";

interface SiteFooterProps {
  readonly locale: Locale;
  /** للمدونة مقال ظاهر بهذه اللغة */
  readonly showBlog: boolean;
  readonly dictionary: Dictionary;
}

const LOGO_HEIGHT = 88;

/** التذييل: الشعار وشعار الجدار، ثم الصفحات والتواصل، والعنوان مكتوبًا. */
export function SiteFooter({ locale, showBlog, dictionary }: SiteFooterProps) {
  return (
    <footer className={styles.footer}>
      <div className={cx("container", styles.inner)}>
        <Logo height={LOGO_HEIGHT} alt="" />
        <div>
          <p className={styles.slogan}>{dictionary.club.slogan}.</p>
          <p>{CLUB_CONTACT.address[locale]}</p>
        </div>
        <nav aria-label={dictionary.footer.pages}>
          <h2 className={styles.heading}>{dictionary.footer.pages}</h2>
          <ul className={styles.links}>
            <li>
              <Link href={localizedPath(locale)}>{dictionary.nav.home}</Link>
            </li>
            <li>
              <Link href={localizedPath(locale, "/memberships")}>{dictionary.nav.memberships}</Link>
            </li>
            {showBlog ? (
              <li>
                <Link href={localizedPath(locale, ROUTES.blog)}>{dictionary.blog.nav}</Link>
              </li>
            ) : null}
            <li>
              <Link href={localizedPath(locale, ROUTES.costPerVisit)}>
                {dictionary.tools.footerLink}
              </Link>
            </li>
          </ul>
        </nav>
        <div>
          <h2 className={styles.heading}>{dictionary.footer.contact}</h2>
          <ul className={styles.links}>
            <li>
              <a href={`tel:${CLUB_CONTACT.phoneE164}`}>
                <bdi>{CLUB_CONTACT.phoneDisplay}</bdi>
              </a>
            </li>
            <li>
              <a href={whatsappUrl(dictionary.location.whatsappMessage)} rel="noopener noreferrer">
                {dictionary.location.whatsapp}
              </a>
            </li>
          </ul>
        </div>
      </div>
      <p className={cx("container", styles.note)}>
        © <bdi>{new Date().getFullYear()}</bdi> {dictionary.club.name}. {dictionary.footer.rights}.
      </p>
    </footer>
  );
}
