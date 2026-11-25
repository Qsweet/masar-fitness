import { Logo } from "../logo";
import { CLUB_FACTS, DEMO_PRICE_NOTE, PAYMENT_METHODS, PAYMENT_NOTE } from "../facts";
import { StickyReveal } from "../sticky-reveal";
import type { MoneyParts } from "@/i18n/format";
import { C3 } from "./copy";
import styles from "./c3.module.css";

const HEADER_LOGO = 46;
const FOOTER_LOGO = 64;

/** الشعار في «بطاقة» داكنة معلّقة من أعلى الصفحة: على خلفيته الأصلية بلا تعديل، والترويسة فاتحة. */
export function Header() {
  return (
    <header className={styles.header}>
      <a href="#top" className={styles.tag}>
        <Logo height={HEADER_LOGO} preload />
      </a>
      <nav aria-label="التنقل الرئيسي" className={styles.nav}>
        {C3.nav.map((item) => (
          <a key={item.href} href={item.href}>
            {item.label}
          </a>
        ))}
      </nav>
      <details className={styles.menu}>
        <summary>{C3.menu}</summary>
        <nav aria-label="قائمة الجوال">
          {C3.nav.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
      </details>
      <a href="#buy" className={styles.headerCta}>
        {C3.join}
      </a>
    </header>
  );
}

export function Payment() {
  return (
    <section className={styles.payment} aria-labelledby="c3-payment">
      <h2 id="c3-payment" className={styles.h3}>
        {C3.payment.title}
      </h2>
      <dl className={styles.paymentTable}>
        {PAYMENT_METHODS.map((method) => (
          <div key={method.name}>
            <dt>{method.name}</dt>
            <dd>{method.note}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.muted}>{PAYMENT_NOTE}</p>
    </section>
  );
}

export function Trust() {
  return (
    <section className={styles.trust} aria-labelledby="c3-trust">
      <h2 id="c3-trust" className={styles.h3}>
        {C3.trust.title}
      </h2>
      <ul className={styles.trustList}>
        {C3.trust.points.map((point) => (
          <li key={point.title}>
            <strong>{point.title}</strong>
            <span>{point.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Visit() {
  return (
    <section id="visit" className={styles.visit} aria-labelledby="c3-visit">
      <div>
        <h2 id="c3-visit" className={styles.h2}>
          {C3.visit.title}
        </h2>
        <p className={styles.visitAddress}>{CLUB_FACTS.address}</p>
        <p className={styles.muted} dir="ltr">
          {CLUB_FACTS.coordinates}
        </p>
      </div>
      <div className={styles.visitActions}>
        <a href={CLUB_FACTS.directions} rel="noopener noreferrer" className={styles.buttonDark}>
          {C3.visit.directions}
        </a>
        <a href={CLUB_FACTS.phoneHref} className={styles.buttonOutline}>
          {C3.visit.call} <bdi>{CLUB_FACTS.phone}</bdi>
        </a>
        <a href={CLUB_FACTS.whatsapp} rel="noopener noreferrer" className={styles.buttonOutline}>
          {C3.visit.whatsapp}
        </a>
      </div>
    </section>
  );
}

export function Final({ fromPrice }: { readonly fromPrice: MoneyParts | undefined }) {
  return (
    <section className={styles.final} aria-labelledby="c3-final">
      <h2 id="c3-final" className={styles.finalTitle}>
        {C3.final.title}
      </h2>
      {fromPrice === undefined ? null : (
        <p className={styles.finalFrom}>
          {C3.hero.from} <bdi>{fromPrice.amount}</bdi> {fromPrice.unit}
        </p>
      )}
      <a href="#buy" className={styles.buttonPrimary}>
        {C3.final.action}
      </a>
    </section>
  );
}

export function Footer() {
  return (
    <footer className={styles.footer}>
      <span className={styles.footerTag}>
        <Logo height={FOOTER_LOGO} />
      </span>
      <div>
        <p className={styles.footerName}>{CLUB_FACTS.name}</p>
        <p className={styles.muted}>{CLUB_FACTS.address}</p>
        <a href={CLUB_FACTS.phoneHref}>
          <bdi>{CLUB_FACTS.phone}</bdi>
        </a>
      </div>
      <p className={styles.footerNote}>
        © {CLUB_FACTS.name}. {C3.footer.rights}. {DEMO_PRICE_NOTE}
      </p>
    </footer>
  );
}

export function StickyBar({ fromPrice }: { readonly fromPrice: MoneyParts | undefined }) {
  return (
    <StickyReveal afterId="top" label="الاشتراك" className={styles.sticky}>
      {fromPrice === undefined ? null : (
        <p>
          {C3.sticky.from}{" "}
          <strong>
            <bdi>{fromPrice.amount}</bdi> {fromPrice.unit}
          </strong>
        </p>
      )}
      <a href="#buy">{C3.sticky.action}</a>
    </StickyReveal>
  );
}
