import Image from "next/image";
import { CLUB_FACTS, FACILITIES } from "../facts";
import { PHOTOS } from "../photos";
import { C1 } from "./copy";
import styles from "./c1.module.css";

/** الواجهة: صورة ممر البنشات بكامل الشاشة، والعنوان في أسفلها كعنوان حملة لا كلافتة. */
export function Hero() {
  return (
    <section id="top" className={styles.hero} aria-labelledby="c1-hero">
      <Image
        src={PHOTOS.benches.src}
        alt={PHOTOS.benches.alt}
        fill
        preload
        placeholder="blur"
        sizes="100vw"
        className={styles.heroImage}
      />
      <div className={styles.heroScrim} aria-hidden="true" />
      <div className={styles.heroContent}>
        <p className={styles.heroMeta}>
          <span>{CLUB_FACTS.district}</span>
          <span dir="ltr">{CLUB_FACTS.coordinates}</span>
        </p>
        <h1 id="c1-hero" className={styles.heroTitle}>
          {C1.hero.title}
        </h1>
        <p className={styles.heroLead}>{C1.hero.lead}</p>
        <div className={styles.heroActions}>
          <a href="#plans" className={styles.buttonPrimary}>
            {C1.hero.primary}
          </a>
          <a href="#visit" className={styles.linkQuiet}>
            {C1.hero.secondary}
          </a>
        </div>
      </div>
    </section>
  );
}

export function Value() {
  return (
    <section id="club" className={styles.value} aria-labelledby="c1-value">
      <h2 id="c1-value" className={styles.statement}>
        {C1.value.title}
      </h2>
      <div className={styles.valueSide}>
        <p className={styles.lead}>{C1.value.lead}</p>
        <dl className={styles.facilityIndex}>
          {FACILITIES.map((facility) => (
            <div key={facility.name}>
              <dt>{facility.name}</dt>
              <dd>{facility.line}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/** معرض غير متماثل: صورة عريضة، وأخرى طويلة تتجاوز خط الأولى، وثالثة كاملة العرض. */
export function Gallery() {
  return (
    <section className={styles.gallery} aria-labelledby="c1-gallery">
      <div className={styles.sectionHead}>
        <h2 id="c1-gallery" className={styles.h2}>
          {C1.gallery.title}
        </h2>
        <p className={styles.lead}>{C1.gallery.lead}</p>
      </div>
      <div className={styles.galleryGrid}>
        <figure className={styles.galleryWide}>
          <Image
            src={PHOTOS.ropes.src}
            alt={PHOTOS.ropes.alt}
            fill
            placeholder="blur"
            sizes="(min-width: 64rem) 58vw, 100vw"
          />
          <figcaption>{FACILITIES[1]?.name}</figcaption>
        </figure>
        <figure className={styles.galleryTall}>
          <Image
            src={PHOTOS.dumbbell.src}
            alt={PHOTOS.dumbbell.alt}
            fill
            placeholder="blur"
            sizes="(min-width: 64rem) 36vw, 100vw"
          />
          <figcaption>{FACILITIES[0]?.name}</figcaption>
        </figure>
        <figure className={styles.galleryFull}>
          <Image
            src={PHOTOS.functional.src}
            alt={PHOTOS.functional.alt}
            fill
            placeholder="blur"
            sizes="(min-width: 64rem) 72vw, 100vw"
          />
        </figure>
      </div>
    </section>
  );
}

/** المسبح: صورة كاملة العرض بلون المحيط العميق، وصورة سطح الماء تتداخل مع حافتها. */
export function Pool() {
  return (
    <section id="pool" className={styles.pool} aria-labelledby="c1-pool">
      <div className={styles.poolStage}>
        <Image
          src={PHOTOS.poolMural.src}
          alt={PHOTOS.poolMural.alt}
          fill
          placeholder="blur"
          sizes="100vw"
          className={styles.poolImage}
        />
        <h2 id="c1-pool" className={styles.poolTitle}>
          {C1.pool.title}
        </h2>
      </div>
      <div className={styles.poolBody}>
        <p className={styles.lead}>{C1.pool.lead}</p>
        <figure className={styles.poolInset}>
          <Image
            src={PHOTOS.poolSurface.src}
            alt={PHOTOS.poolSurface.alt}
            fill
            placeholder="blur"
            sizes="(min-width: 64rem) 26rem, 100vw"
          />
        </figure>
      </div>
    </section>
  );
}
