import Image from "next/image";
import { CLUB_FACTS, PAYMENT_METHODS, PAYMENT_NOTE } from "../facts";
import { PHOTOS } from "../photos";
import { C2 } from "./copy";
import styles from "./c2.module.css";

export function Benefits({ benefits }: { readonly benefits: readonly string[] }) {
  if (benefits.length === 0) {
    return null;
  }
  return (
    <section className={styles.benefits} aria-labelledby="c2-benefits">
      <h2 id="c2-benefits" className={styles.h2}>
        {C2.benefits.title}
      </h2>
      <ul className={styles.benefitList}>
        {benefits.map((benefit) => (
          <li key={benefit}>{benefit}</li>
        ))}
      </ul>
    </section>
  );
}

export function Payment() {
  return (
    <section className={styles.payment} aria-labelledby="c2-payment">
      <h2 id="c2-payment" className={styles.h3}>
        {C2.payment.title}
      </h2>
      <ul className={styles.paymentList}>
        {PAYMENT_METHODS.map((method) => (
          <li key={method.name}>
            <strong>{method.name}</strong>
            <span>{method.note}</span>
          </li>
        ))}
      </ul>
      <p className={styles.small}>{PAYMENT_NOTE}</p>
    </section>
  );
}

export function Trust() {
  return (
    <section className={styles.trust} aria-labelledby="c2-trust">
      <div className={styles.trustText}>
        <h2 id="c2-trust" className={styles.h2}>
          {C2.trust.title}
        </h2>
        <ul>
          {C2.trust.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </div>
      <figure className={styles.trustPhoto}>
        <Image
          src={PHOTOS.benches.src}
          alt={PHOTOS.benches.alt}
          fill
          placeholder="blur"
          sizes="(min-width: 64rem) 50vw, 100vw"
        />
      </figure>
    </section>
  );
}

export function Visit() {
  return (
    <section id="visit" className={styles.visit} aria-labelledby="c2-visit">
      <h2 id="c2-visit" className={styles.h2}>
        {C2.visit.title}
      </h2>
      <p className={styles.visitAddress}>{CLUB_FACTS.address}</p>
      <div className={styles.visitActions}>
        <a href={CLUB_FACTS.directions} rel="noopener noreferrer" className={styles.buttonInk}>
          {C2.visit.directions}
        </a>
        <a href={CLUB_FACTS.phoneHref} className={styles.buttonLine}>
          {C2.visit.call} <bdi>{CLUB_FACTS.phone}</bdi>
        </a>
        <a href={CLUB_FACTS.whatsapp} rel="noopener noreferrer" className={styles.buttonLine}>
          {C2.visit.whatsapp}
        </a>
      </div>
    </section>
  );
}

export function Final() {
  return (
    <section className={styles.final} aria-labelledby="c2-final">
      <h2 id="c2-final" className={styles.finalTitle}>
        {C2.final.title}
      </h2>
      <a href="#plans" className={styles.buttonYellow}>
        {C2.final.action}
      </a>
    </section>
  );
}
