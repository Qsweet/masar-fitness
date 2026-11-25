import { Logo } from "../logo";
import { CLUB_FACTS, DEMO_PRICE_NOTE } from "../facts";
import { StickyReveal } from "../sticky-reveal";
import type { MoneyParts } from "@/i18n/format";
import { C2 } from "./copy";
import styles from "./c2.module.css";

const HEADER_LOGO = 48;
const FOOTER_LOGO = 88;

/** شريط أسود صريح، وكتلة «اشترك الآن» صفراء بكامل ارتفاعه في طرفه. */
export function Header() {
  return (
    <header className={styles.header}>
      <a href="#top" className={styles.brand}>
        <Logo height={HEADER_LOGO} preload />
      </a>
      <nav aria-label="التنقل الرئيسي" className={styles.nav}>
        {C2.nav.map((item) => (
          <a key={item.href} href={item.href}>
            {item.label}
          </a>
        ))}
      </nav>
      <details className={styles.menu}>
        <summary>{C2.menu}</summary>
        <nav aria-label="قائمة الجوال">
          {C2.nav.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
      </details>
      <a href="#plans" className={styles.headerCta}>
        {C2.join}
      </a>
    </header>
  );
}

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <Logo height={FOOTER_LOGO} />
        <p className={styles.footerSlogan}>{CLUB_FACTS.wallSlogans.arabic}.</p>
        <div className={styles.footerContact}>
          <p>{CLUB_FACTS.address}</p>
          <a href={CLUB_FACTS.phoneHref}>
            <bdi>{CLUB_FACTS.phone}</bdi>
          </a>
        </div>
      </div>
      <p className={styles.footerNote}>
        © {CLUB_FACTS.name}. {C2.footer.rights}. {DEMO_PRICE_NOTE}
      </p>
    </footer>
  );
}

export function StickyBar({ fromPrice }: { readonly fromPrice: MoneyParts | undefined }) {
  return (
    <StickyReveal afterId="top" label="الاشتراك" className={styles.sticky}>
      {fromPrice === undefined ? null : (
        <p>
          {C2.sticky.from}{" "}
          <strong>
            <bdi>{fromPrice.amount}</bdi> {fromPrice.unit}
          </strong>
        </p>
      )}
      <a href="#plans">{C2.sticky.action}</a>
    </StickyReveal>
  );
}
