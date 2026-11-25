import { Fragment } from "react";
import { buttonClass } from "@/components/ui/button-link";
import type { Dictionary } from "@/i18n/dictionaries";
import { HeroMedia } from "./hero-media";
import styles from "./hero.module.css";

/** معرّف الواجهة: شريط الشراء الثابت يظهر بعد أن تغادر الشاشة. */
export const HERO_ID = "top";

/**
 * الواجهة: النادي نفسه أولًا (مقطع صامت أو إطاره)، ثم شعار الجدار عنوانًا متزنًا مع السطر التعريفي
 * والفعل. على الشاشة الواسعة: النص على الحبر بجانب الوسائط بحافة مائلة.
 */
export function Hero({ dictionary }: { readonly dictionary: Dictionary }) {
  const { hero, photos } = dictionary;
  return (
    <section id={HERO_ID} className={styles.hero} aria-labelledby="hero-title">
      <HeroMedia
        posterAlt={photos.heroPoster}
        pauseLabel={hero.pauseVideo}
        playLabel={hero.playVideo}
      />
      <div className={styles.text}>
        <h1 id="hero-title" className={styles.title}>
          {/* مسافة بين الكلمتين حتى يُقرأ العنوان جملة واحدة */}
          {hero.titleLines.map((line) => (
            <Fragment key={line}>
              <span>{line}</span>{" "}
            </Fragment>
          ))}
        </h1>
        <p className={styles.lead}>{hero.lead}</p>
        <div className={styles.actions}>
          <a href="#plans" className={buttonClass("yellow")}>
            {hero.action}
          </a>
          <a href="#facilities" className={buttonClass("line")}>
            {hero.secondary}
          </a>
        </div>
        <p className={styles.note}>{hero.wallNote}</p>
      </div>
    </section>
  );
}
