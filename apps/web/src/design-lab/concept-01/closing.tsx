import Image from "next/image";
import { CLUB_FACTS, PAYMENT_METHODS, PAYMENT_NOTE } from "../facts";
import { PHOTOS } from "../photos";
import { C1 } from "./copy";
import styles from "./c1.module.css";

export function Benefits({ benefits }: { readonly benefits: readonly string[] }) {
  if (benefits.length === 0) {
    return null;
  }
  return (
    <section className={styles.benefits} aria-labelledby="c1-benefits">
      <h2 id="c1-benefits" className={styles.h2}>
        {C1.benefits.title}
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
    <section className={styles.payment} aria-labelledby="c1-payment">
      <h2 id="c1-payment" className={styles.h3}>
        {C1.payment.title}
      </h2>
      <ul className={styles.paymentList}>
        {PAYMENT_METHODS.map((method) => (
          <li key={method.name}>
            <span className={styles.paymentName}>{method.name}</span>
            <span className={styles.paymentNote}>{method.note}</span>
          </li>
        ))}
      </ul>
      <p className={styles.small}>{PAYMENT_NOTE}</p>
    </section>
  );
}

export function Trust() {
  return (
    <section className={styles.trust} aria-labelledby="c1-trust">
      <figure className={styles.trustImage}>
        <Image
          src={PHOTOS.poolWall.src}
          alt={PHOTOS.poolWall.alt}
          fill
          placeholder="blur"
          sizes="(min-width: 64rem) 50vw, 100vw"
        />
      </figure>
      <div className={styles.trustBody}>
        <h2 id="c1-trust" className={styles.h2}>
          {C1.trust.title}
        </h2>
        <ul className={styles.trustList}>
          {C1.trust.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Visit() {
  return (
    <section id="visit" className={styles.visit} aria-labelledby="c1-visit">
      <h2 id="c1-visit" className={styles.h2}>
        {C1.visit.title}
      </h2>
      <div className={styles.visitBody}>
        <p className={styles.visitAddress}>{CLUB_FACTS.address}</p>
        <p className={styles.visitCoords} dir="ltr">
          {CLUB_FACTS.coordinates}
        </p>
        <p className={styles.small}>{C1.visit.hours}</p>
        <div className={styles.visitActions}>
          <a
            href={CLUB_FACTS.directions}
            rel="noopener noreferrer"
            className={styles.buttonPrimary}
          >
            {C1.visit.directions}
          </a>
          <a href={CLUB_FACTS.phoneHref} className={styles.buttonGhost}>
            {C1.visit.call}: <bdi>{CLUB_FACTS.phone}</bdi>
          </a>
          <a href={CLUB_FACTS.whatsapp} rel="noopener noreferrer" className={styles.buttonGhost}>
            {C1.visit.whatsapp}
          </a>
        </div>
      </div>
    </section>
  );
}

export function Final() {
  return (
    <section className={styles.final} aria-labelledby="c1-final">
      <Image
        src={PHOTOS.curlMachine.src}
        alt=""
        fill
        placeholder="blur"
        sizes="100vw"
        className={styles.finalImage}
      />
      <div className={styles.finalScrim} aria-hidden="true" />
      <div className={styles.finalContent}>
        <h2 id="c1-final" className={styles.finalTitle}>
          {C1.final.title}
        </h2>
        <a href="#plans" className={styles.buttonPrimary}>
          {C1.final.action}
        </a>
      </div>
    </section>
  );
}
