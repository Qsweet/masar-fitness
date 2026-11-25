import { Logo } from "../logo";
import { CLUB_FACTS, DEMO_PRICE_NOTE } from "../facts";
import { StickyReveal } from "../sticky-reveal";
import type { MoneyParts } from "@/i18n/format";
import { C1 } from "./copy";
import styles from "./c1.module.css";

const HEADER_LOGO = 64;
const FOOTER_LOGO = 96;

/** ترويسة شفافة فوق الصورة؛ على الجوال قائمة <details> تعمل بلا JavaScript. */
export function Header() {
  return (
    <header className={styles.header}>
      <a href="#top" className={styles.brand}>
        <Logo height={HEADER_LOGO} preload />
      </a>
      <nav aria-label="التنقل الرئيسي" className={styles.nav}>
        {C1.nav.map((item) => (
          <a key={item.href} href={item.href}>
            {item.label}
          </a>
        ))}
      </nav>
      <a href="#plans" className={styles.headerCta}>
        {C1.join}
      </a>
      <details className={styles.menu}>
        <summary>{C1.menu}</summary>
        <nav aria-label="قائمة الجوال">
          {C1.nav.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
      </details>
    </header>
  );
}

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <Logo height={FOOTER_LOGO} />
        <div>
          <p className={styles.footerName}>{CLUB_FACTS.name}</p>
          <p>{CLUB_FACTS.address}</p>
          <p>
            <a href={CLUB_FACTS.phoneHref}>
              <bdi>{CLUB_FACTS.phone}</bdi>
            </a>
          </p>
        </div>
        <nav aria-label="روابط التذييل" className={styles.footerNav}>
          {C1.nav.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
      </div>
      <p className={styles.footerNote}>
        © {CLUB_FACTS.name}. {C1.footer.rights}. {DEMO_PRICE_NOTE}
      </p>
    </footer>
  );
}

/** شريط شراء ثابت للجوال فقط، يظهر بعد الواجهة ولا يغطي محتوى (للصفحة هامش سفلي بارتفاعه). */
export function StickyBar({ fromPrice }: { readonly fromPrice: MoneyParts | undefined }) {
  return (
    <StickyReveal afterId="top" label="الاشتراك" className={styles.sticky}>
      {fromPrice === undefined ? null : (
        <p>
          <span>{C1.sticky.from}</span>{" "}
          <strong>
            <bdi>{fromPrice.amount}</bdi> {fromPrice.unit}
          </strong>
        </p>
      )}
      <a href="#plans">{C1.sticky.action}</a>
    </StickyReveal>
  );
}
