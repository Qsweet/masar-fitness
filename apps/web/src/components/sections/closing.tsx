import Image from "next/image";
import { ButtonLink } from "@/components/ui/button-link";
import { CLUB_CONTACT, directionsUrl, whatsappUrl } from "@/config/club";
import { PHOTOS } from "@/config/photos";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/locales";
import { cx } from "@/lib/cx";
import styles from "./closing.module.css";

interface SectionProps {
  readonly dictionary: Dictionary;
}

/** ما يشمله الاشتراك، قائمة بعلامات صح مرسومة. لا يظهر إن لم تُسجَّل مزايا. */
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
      <h2 id="benefits-title" className="title-block">
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

/**
 * طرق الدفع المفصّلة. تعرضها الصفحة والشراء الإلكتروني مفتوح فقط (isCheckoutEnabled)؛ قبله يكفي سطر
 * واحد صادق بجانب زر واتساب (plan.buyNote)، حتى لا يبدو أن الموقع يقبل الدفع وهو لا يقبله.
 */
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

/** «موقع النادي»: العنوان والدعوة إلى السؤال على الأصفر، ثم الخريطة والاتصال وواتساب بعرض واحد. */
export function Visit({ locale, dictionary }: SectionProps & { readonly locale: Locale }) {
  const { location, photos } = dictionary;
  return (
    <section id="location" className={styles.visit} aria-labelledby="location-title">
      <div className={cx("container", styles.visitInner)}>
        <div className={styles.visitText}>
          <h2 id="location-title" className="title-section">
            {location.title}
          </h2>
          <p className={styles.visitAddress}>{CLUB_CONTACT.address[locale]}</p>
          <p className={styles.visitLead}>{location.lead}</p>
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
        <figure className={styles.visitPhoto}>
          <Image
            src={PHOTOS.consultation}
            alt={photos.consultation}
            fill
            placeholder="blur"
            sizes="(min-width: 64rem) 40vw, 100vw"
          />
        </figure>
      </div>
    </section>
  );
}

/** الدعوة الأخيرة على الحبر، بجانب صورة مدرب من النادي بقميصه (بلا اسم ولا صفة غير ما يظهر). */
export function Final({ dictionary }: SectionProps) {
  const { final, photos } = dictionary;
  return (
    <section className={styles.final} aria-labelledby="final-title">
      <div className={cx("container", styles.finalInner)}>
        <div className={styles.finalText}>
          <h2 id="final-title" className={styles.finalTitle}>
            {final.title}
          </h2>
          <ButtonLink href="#plans" variant="yellow" external>
            {final.action}
          </ButtonLink>
        </div>
        <figure className={styles.finalPhoto}>
          <Image
            src={PHOTOS.trainerPortrait}
            alt={photos.trainerPortrait}
            fill
            placeholder="blur"
            sizes="(min-width: 64rem) 45vw, 100vw"
          />
        </figure>
      </div>
    </section>
  );
}
