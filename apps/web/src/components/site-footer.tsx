import Link from "next/link";
import { BrandMark } from "@/components/ui/brand-mark";
import { Icon } from "@/components/ui/icon";
import { CLUB_CONTACT, whatsappUrl } from "@/config/club";
import { CLUB_FACTS, SOCIAL_LINKS } from "@/config/club-facts";
import { ROUTES } from "@/config/routes";
import type { Dictionary } from "@/i18n/dictionaries";
import { localizedPath, type Locale } from "@/i18n/locales";
import { cx } from "@/lib/cx";
import styles from "./site-footer.module.css";

interface SiteFooterProps {
  readonly locale: Locale;
  /** للمدونة مقال ظاهر بهذه اللغة */
  readonly showBlog: boolean;
  /** الشراء الإلكتروني مفتوح: صف طرق الدفع بدل السطر الصادق عن واتساب */
  readonly checkoutEnabled: boolean;
  readonly dictionary: Dictionary;
}

interface FooterLink {
  readonly href: string;
  readonly label: string;
}

function LinkColumn({ title, links }: { readonly title: string; readonly links: FooterLink[] }) {
  return (
    <nav aria-label={title}>
      <h2 className={styles.heading}>{title}</h2>
      <ul className={styles.links}>
        {links.map((link) => (
          <li key={link.label}>
            <Link href={link.href}>{link.label}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function pageLinks({ locale, showBlog, dictionary }: SiteFooterProps): FooterLink[] {
  const home = localizedPath(locale);
  return [
    { href: home, label: dictionary.nav.home },
    { href: `${home}#about`, label: dictionary.nav.about },
    { href: `${home}#facilities`, label: dictionary.nav.facilities },
    { href: localizedPath(locale, ROUTES.memberships), label: dictionary.nav.memberships },
    ...(showBlog ? [{ href: localizedPath(locale, ROUTES.blog), label: dictionary.blog.nav }] : []),
    { href: localizedPath(locale, ROUTES.costPerVisit), label: dictionary.tools.footerLink },
  ];
}

function programLinks({ locale, dictionary }: SiteFooterProps): FooterLink[] {
  const home = localizedPath(locale);
  const { items } = dictionary.services;
  return [
    ...[items.personalTraining, items.rehab, items.swimming].map((item) => ({
      href: `${home}#services`,
      label: item.name,
    })),
    { href: `${home}#friends`, label: dictionary.friends.eyebrow },
  ];
}

function Brand({ dictionary }: { readonly dictionary: Dictionary }) {
  return (
    <div className={styles.brand}>
      <BrandMark dictionary={dictionary} onDark />
      <p>{dictionary.footer.tagline}</p>
      <ul className={styles.social} aria-label={dictionary.footer.social}>
        {SOCIAL_LINKS.map((social) => (
          <li key={social.id}>
            <a
              href={social.url}
              rel="noopener noreferrer"
              aria-label={dictionary.footer.socialNames[social.id]}
            >
              <Icon name={social.id} />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ContactColumn({ locale, dictionary }: Pick<SiteFooterProps, "locale" | "dictionary">) {
  return (
    <div>
      <h2 className={styles.heading}>{dictionary.footer.contact}</h2>
      <ul className={styles.contact}>
        <li>
          <Icon name="pin" />
          <span>{CLUB_CONTACT.address[locale]}</span>
        </li>
        <li>
          <Icon name="phone" />
          <a href={`tel:${CLUB_CONTACT.phoneE164}`}>
            <bdi>{CLUB_CONTACT.phoneDisplay}</bdi>
          </a>
        </li>
        <li>
          <Icon name="chat" />
          <a href={whatsappUrl(dictionary.location.whatsappMessage)} rel="noopener noreferrer">
            {dictionary.location.whatsapp}
          </a>
        </li>
        <li>
          <Icon name="mail" />
          <a href={`mailto:${CLUB_FACTS.email}`}>
            <bdi>{CLUB_FACTS.email}</bdi>
          </a>
        </li>
      </ul>
    </div>
  );
}

/** الشريط السفلي: الحقوق والسجل التجاري، وطرق الدفع والشراء مفتوح أو السطر الصادق عن واتساب. */
function BottomBar({ checkoutEnabled, dictionary }: SiteFooterProps) {
  const { footer, payment, club } = dictionary;
  return (
    <div className={cx("container", styles.bottom)}>
      <p>
        © <bdi>{new Date().getFullYear()}</bdi> {club.name}. {footer.rights}.
      </p>
      <p>
        {footer.registration} <bdi>{CLUB_FACTS.commercialRegistration}</bdi>
      </p>
      {checkoutEnabled ? (
        <ul className={styles.payments} aria-label={payment.title}>
          {payment.methods.map((method) => (
            <li key={method.name}>{method.name}</li>
          ))}
        </ul>
      ) : (
        <p>{footer.joinNote}</p>
      )}
    </div>
  );
}

/** التذييل الداكن بأربعة أعمدة: العلامة والحسابات، الروابط، البرامج، التواصل. */
export function SiteFooter(props: SiteFooterProps) {
  const { dictionary } = props;
  return (
    <footer className={styles.footer}>
      <div className={cx("container", styles.inner)}>
        <Brand dictionary={dictionary} />
        <LinkColumn title={dictionary.footer.pages} links={pageLinks(props)} />
        <LinkColumn title={dictionary.footer.programs} links={programLinks(props)} />
        <ContactColumn locale={props.locale} dictionary={dictionary} />
      </div>
      <BottomBar {...props} />
    </footer>
  );
}
