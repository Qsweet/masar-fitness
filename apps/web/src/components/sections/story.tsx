import Image from "next/image";
import { Fragment } from "react";
import { buttonClass } from "@/components/ui/button-link";
import { PHOTOS, type PhotoKey } from "@/config/photos";
import type { Dictionary } from "@/i18n/dictionaries";
import { cx } from "@/lib/cx";
import heroStyles from "./hero.module.css";
import styles from "./story.module.css";

interface SectionProps {
  readonly dictionary: Dictionary;
}

/** معرّف الواجهة: شريط الشراء الثابت يظهر بعد أن تغادر الشاشة. */
export const HERO_ID = "top";

/** العنوان شعار جدار النادي بحجم ملصق، يتخطى حافة الصورة المائلة بالأبيض والأسود. */
export function Hero({ dictionary }: SectionProps) {
  const { hero, photos } = dictionary;
  return (
    <section id={HERO_ID} className={heroStyles.hero} aria-labelledby="hero-title">
      <div className={heroStyles.heroText}>
        <h1 id="hero-title" className={heroStyles.heroTitle}>
          {/* مسافة بين الأسطر حتى يُقرأ العنوان كلمتين (الشبكة تتجاهلها بصريًا) */}
          {hero.titleLines.map((line) => (
            <Fragment key={line}>
              <span>{line}</span>{" "}
            </Fragment>
          ))}
        </h1>
        <p className={heroStyles.heroNote}>{hero.wallNote}</p>
        <p className={heroStyles.heroLead}>{hero.lead}</p>
        <a href="#plans" className={buttonClass("ink")}>
          {hero.action}
        </a>
      </div>
      <figure className={heroStyles.heroPhoto}>
        <Image
          src={PHOTOS.ropes}
          alt={photos.ropes}
          fill
          preload
          placeholder="blur"
          sizes="(min-width: 64rem) 55vw, 100vw"
        />
        <span className={heroStyles.heroSlash} aria-hidden="true" />
      </figure>
    </section>
  );
}

/** المرافق سطر واحد ضخم تفصله خطوط مائلة، كلافتة حملة. */
export function FacilityLine({ dictionary }: SectionProps) {
  const { facilities } = dictionary;
  return (
    <section id="facilities" className={heroStyles.value} aria-label={facilities.label}>
      <p className={heroStyles.valueLabel}>{facilities.label}</p>
      <ul className={heroStyles.valueLine}>
        {facilities.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

/** شريط الحملة: ثلاث صور بالأبيض والأسود بارتفاعات مختلفة ومحاذاة سفلية. */
export function Train({ dictionary }: SectionProps) {
  const { train, facilities, photos } = dictionary;
  const shots: readonly {
    key: PhotoKey;
    caption: string | undefined;
    className: string | undefined;
  }[] = [
    { key: "dumbbell", caption: facilities.items[0], className: styles.trainTall },
    { key: "functional", caption: facilities.items[1], className: styles.trainWide },
    { key: "curlMachine", caption: undefined, className: styles.trainMid },
  ];
  return (
    <section id="train" className={cx("container", styles.train)} aria-labelledby="train-title">
      <div className={styles.head}>
        <h2 id="train-title" className="title-section">
          {train.title}
        </h2>
        <p className="muted">{train.lead}</p>
      </div>
      <div className={styles.trainStrip}>
        {shots.map(({ key, caption, className }) => (
          <figure key={key} className={className}>
            <Image
              src={PHOTOS[key]}
              alt={photos[key]}
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

/** الماء هو اللون الوحيد في الموقع: كل الصور رمادية إلا المسبح. */
export function Water({ dictionary }: SectionProps) {
  const { water, photos } = dictionary;
  return (
    <section id="water" className={styles.water} aria-labelledby="water-title">
      <figure className={styles.waterPhoto}>
        <Image
          src={PHOTOS.poolMural}
          alt={photos.poolMural}
          fill
          placeholder="blur"
          sizes="100vw"
        />
      </figure>
      <div className={cx("container", styles.waterText)}>
        <h2 id="water-title" className={styles.waterTitle}>
          {water.title}
        </h2>
        <p>{water.lead}</p>
      </div>
    </section>
  );
}

export function Trust({ dictionary }: SectionProps) {
  const { trust, photos } = dictionary;
  return (
    <section className={styles.trust} aria-labelledby="trust-title">
      <div className={styles.trustText}>
        <h2 id="trust-title" className="title-section">
          {trust.title}
        </h2>
        <ul>
          {trust.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </div>
      <figure className={styles.trustPhoto}>
        <Image
          src={PHOTOS.benches}
          alt={photos.benches}
          fill
          placeholder="blur"
          sizes="(min-width: 64rem) 50vw, 100vw"
        />
      </figure>
    </section>
  );
}
