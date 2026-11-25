import { ButtonLink } from "@/components/ui/button-link";
import { CLUB_CONTACT, directionsUrl, whatsappUrl } from "@/config/club";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/locales";
import { cx } from "@/lib/cx";
import styles from "./closing.module.css";

interface SectionProps {
  readonly dictionary: Dictionary;
}

/** ما يشمله الاشتراك، قائمة ضخمة بخطوط مائلة. لا يظهر إن لم تُسجَّل مزايا. */
export function Benefits({
  title,
  benefits,
}: {
  readonly title: string;
  readonly benefits: readonly string[];
}) {
  if (benefits.length === 0) {
    return null;
  }
  return (
    <section className={cx("container", styles.benefits)} aria-labelledby="benefits-title">
      <h2 id="benefits-title" className="title-section">
        {title}
      </h2>
      <ul className={styles.benefitList}>
        {benefits.map((benefit) => (
          <li key={benefit}>{benefit}</li>
        ))}
      </ul>
    </section>
  );
}

export function Payment({ dictionary }: SectionProps) {
  const { payment } = dictionary;
  return (
    <section className={cx("container", styles.payment)} aria-labelledby="payment-title">
      <h2 id="payment-title" className="title-block">
        {payment.title}
      </h2>
      <ul className={styles.paymentList}>
        {payment.methods.map((method) => (
          <li key={method.name}>
            <strong>{method.name}</strong>
            <span>{method.note}</span>
          </li>
        ))}
      </ul>
      <p className="muted small">{payment.note}</p>
    </section>
  );
}

/** «وين نحن»: العنوان بحجم كبير على الأصفر، ثم الخريطة والاتصال وواتساب. */
export function Visit({ locale, dictionary }: SectionProps & { readonly locale: Locale }) {
  const { location } = dictionary;
  return (
    <section id="location" className={styles.visit} aria-labelledby="location-title">
      <div className={cx("container", styles.visitInner)}>
        <h2 id="location-title" className="title-section">
          {location.title}
        </h2>
        <p className={styles.visitAddress}>{CLUB_CONTACT.address[locale]}</p>
        <div className={styles.visitActions}>
          <ButtonLink href={directionsUrl()} external>
            {location.directions}
          </ButtonLink>
          <ButtonLink href={`tel:${CLUB_CONTACT.phoneE164}`} variant="line" external>
            {location.call} <bdi>{CLUB_CONTACT.phoneDisplay}</bdi>
          </ButtonLink>
          <ButtonLink href={whatsappUrl(location.whatsappMessage)} variant="line" external>
            {location.whatsapp}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

export function Final({ dictionary }: SectionProps) {
  const { final } = dictionary;
  return (
    <section className={styles.final} aria-labelledby="final-title">
      <div className={cx("container", styles.finalInner)}>
        <h2 id="final-title" className={styles.finalTitle}>
          {final.title}
        </h2>
        <ButtonLink href="#plans" variant="yellow" external>
          {final.action}
        </ButtonLink>
      </div>
    </section>
  );
}
