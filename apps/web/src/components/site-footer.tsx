import Image from "next/image";
import Link from "next/link";
import { hoursRows } from "@/components/home/hours-view";
import { Icon } from "@/components/ui/icon";
import { PrivacySettingsButton } from "@/components/tracking/privacy-settings-button";
import { Logo } from "@/components/ui/logo";
import { CLUB_CONTACT, whatsappUrl } from "@/config/club";
import { CLUB_FACTS, SOCIAL_LINKS } from "@/config/club-facts";
import { PAYMENT_MARKS } from "@/config/payment-marks";
import { ROUTES } from "@/config/routes";
import type { Dictionary } from "@/i18n/dictionaries";
import { localizedPath, type Locale } from "@/i18n/locales";
import { cx } from "@/lib/cx";
import styles from "./site-footer.module.css";

interface SiteFooterProps {
  readonly locale: Locale;
  /** منصة قياس مفعّلة: رابط «إعدادات الخصوصية» يعيد فتح شريط الموافقة. */
  readonly trackingActive?: boolean;
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
    <div className={cx(styles.brand, styles.wide)}>
      <Logo variant="stacked" height="var(--footer-logo-height)" alt={dictionary.club.logoAlt} />
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
    <div className={styles.wide}>
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
      <FooterHours dictionary={dictionary} />
    </div>
  );
}

/** أوقات النادي مختصرة تحت التواصل، من config/hours.ts كقسم الأوقات في الرئيسية. */
function FooterHours({ dictionary }: { readonly dictionary: Dictionary }) {
  return (
    <div className={styles.hours}>
      <h3 className={styles.subheading}>
        <Icon name="clock" />
        {dictionary.footer.hours}
      </h3>
      <dl>
        {hoursRows("club", dictionary).map((row) => (
          <div key={row.days}>
            <dt>{row.days}</dt>
            <dd>
              <bdi>{row.range}</bdi>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** شعارات طرق الدفع الرسمية على بلاطات بيضاء متساوية، والتحويل البنكي بأيقونة واسمه. */
function PaymentMarks({ dictionary }: { readonly dictionary: Dictionary }) {
  const names = dictionary.footer.paymentMarks;
  return (
    <ul className={styles.payments} aria-label={dictionary.payment.title}>
      {PAYMENT_MARKS.map((mark) => (
        <li key={mark.id} className={styles.mark}>
          <Image src={mark.logo} alt={names[mark.id]} unoptimized className={styles.markLogo} />
        </li>
      ))}
      <li className={cx(styles.mark, styles.bank)}>
        <Icon name="bank" />
        <span>{names.bank}</span>
      </li>
    </ul>
  );
}

/**
 * الشريط السفلي: شعارات طرق الدفع التي يقبلها النادي، والحقوق، والسطر الصادق عن واتساب ما دام
 * الشراء الإلكتروني مغلقًا.
 * لا رقم سجل تجاري: الرقم الوحيد في موقع النادي من شارة سلة، ونوعه ينتظر تأكيد المالك (CLUB_FACTS §13).
 */
/** سياسة الخصوصية دائمًا، و«إعدادات الخصوصية» حين يوجد ما يُوافَق عليه. */
function PrivacyLinks({ locale, trackingActive, dictionary }: SiteFooterProps) {
  const { consent } = dictionary;
  return (
    <p className={styles.privacy}>
      <Link href={localizedPath(locale, ROUTES.privacy)}>{consent.privacyLink}</Link>
      {trackingActive === true ? (
        <PrivacySettingsButton label={consent.settingsLink} className={styles.privacyButton} />
      ) : null}
    </p>
  );
}

function BottomBar(props: SiteFooterProps) {
  const { checkoutEnabled, dictionary } = props;
  const { footer, club } = dictionary;
  return (
    <div className={cx("container", styles.bottom)}>
      <p className={styles.rights}>
        © <bdi>{new Date().getFullYear()}</bdi> {club.name}. {footer.rights}.
      </p>
      <PaymentMarks dictionary={dictionary} />
      <PrivacyLinks {...props} />
      {checkoutEnabled ? null : <p className={styles.note}>{footer.joinNote}</p>}
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
