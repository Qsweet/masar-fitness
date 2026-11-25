import Image from "next/image";
import { CLUB_FACTS, FACILITIES } from "../facts";
import { PHOTOS } from "../photos";
import { C2 } from "./copy";
import styles from "./c2.module.css";

/** العنوان شعار جدار النادي بحجم ملصق، يتخطى حافة الصورة المائلة بالأبيض والأسود. */
export function Hero() {
  return (
    <section id="top" className={styles.hero} aria-labelledby="c2-hero">
      <div className={styles.heroText}>
        <h1 id="c2-hero" className={styles.heroTitle}>
          {C2.hero.titleLines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </h1>
        <p className={styles.heroNote}>
          «{CLUB_FACTS.wallSlogans.arabic}»: {C2.hero.wallNote}
        </p>
        <p className={styles.heroLead}>{C2.hero.lead}</p>
        <a href="#plans" className={styles.buttonInk}>
          {C2.hero.primary}
        </a>
      </div>
      <figure className={styles.heroPhoto}>
        <Image
          src={PHOTOS.ropes.src}
          alt={PHOTOS.ropes.alt}
          fill
          preload
          placeholder="blur"
          sizes="(min-width: 64rem) 55vw, 100vw"
        />
        <span className={styles.heroSlash} aria-hidden="true" />
      </figure>
    </section>
  );
}

/** المرافق سطر واحد ضخم بخطوط مائلة، كلافتة حملة. */
export function Value() {
  return (
    <section className={styles.value} aria-label={C2.value.label}>
      <p className={styles.valueLabel}>{C2.value.label}</p>
      <ul className={styles.valueLine}>
        {FACILITIES.map((facility) => (
          <li key={facility.name}>{facility.name}</li>
        ))}
      </ul>
    </section>
  );
}

/** شريط الحملة: ثلاث صور بالأبيض والأسود بارتفاعات مختلفة ومحاذاة سفلية. */
export function Train() {
  const shots = [
    { photo: PHOTOS.dumbbell, caption: FACILITIES[0]?.name, className: styles.trainTall },
    { photo: PHOTOS.functional, caption: FACILITIES[1]?.name, className: styles.trainWide },
    { photo: PHOTOS.curlMachine, caption: undefined, className: styles.trainMid },
  ];
  return (
    <section id="train" className={styles.train} aria-labelledby="c2-train">
      <div className={styles.trainHead}>
        <h2 id="c2-train" className={styles.h2}>
          {C2.train.title}
        </h2>
        <p>{C2.train.lead}</p>
      </div>
      <div className={styles.trainStrip}>
        {shots.map(({ photo, caption, className }) => (
          <figure key={photo.alt} className={className}>
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              placeholder="blur"
              sizes="(min-width: 64rem) 40vw, 100vw"
            />
            {caption === undefined ? null : <figcaption>{caption}</figcaption>}
          </figure>
        ))}
      </div>
    </section>
  );
}

/** الماء هو اللون الوحيد في الصفحة: كل الصور رمادية إلا المسبح. */
export function Water() {
  return (
    <section id="water" className={styles.water} aria-labelledby="c2-water">
      <figure className={styles.waterPhoto}>
        <Image
          src={PHOTOS.poolMural.src}
          alt={PHOTOS.poolMural.alt}
          fill
          placeholder="blur"
          sizes="100vw"
        />
      </figure>
      <div className={styles.waterText}>
        <h2 id="c2-water" className={styles.waterTitle}>
          {C2.water.title}
        </h2>
        <p>{C2.water.lead}</p>
      </div>
    </section>
  );
}
