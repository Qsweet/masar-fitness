import Image from "next/image";
import { buttonClass } from "@/components/ui/button-link";
import { PHOTOS } from "@/config/photos";
import type { Dictionary } from "@/i18n/dictionaries";
import styles from "./hero.module.css";

/** معرّف الواجهة. */
const HERO_ID = "top";
/** معرّف فعلَي الواجهة: شريط الشراء الثابت يظهر بعد أن يغادرا الشاشة (من أول تمرير تقريبًا). */
export const HERO_ACTIONS_ID = "hero-actions";

/**
 * الواجهة: صورة من النادي بوجه وجهد (عنصر LCP المحمَّل مسبقًا)، ثم شعار الجدار «أنت قدها.» سطرًا كبيرًا
 * (فقرة، لا عنوان)، وتحته عنوان الصفحة h1 بالفصحى يسمّي النادي والمدينة والمرافق، ثم السطر التعريفي
 * والفعلان. على الشاشة الواسعة: النص على الحبر بجانب الصورة بحافة مائلة.
 */
export function Hero({ dictionary }: { readonly dictionary: Dictionary }) {
  const { hero, photos } = dictionary;
  return (
    <section id={HERO_ID} className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.media}>
        <Image
          src={PHOTOS.functionalPress}
          alt={photos.functionalPress}
          fill
          preload
          placeholder="blur"
          sizes="(min-width: 64rem) 50vw, 100vw"
        />
      </div>
      <div className={styles.text}>
        <p className={styles.slogan}>{hero.slogan}</p>
        <h1 id="hero-title" className={styles.title}>
          {hero.title}
        </h1>
        <p className={styles.lead}>{hero.lead}</p>
        <div id={HERO_ACTIONS_ID} className={styles.actions}>
          <a href="#plans" className={buttonClass("yellow")}>
            {hero.action}
          </a>
          <a href="#facilities" className={buttonClass("line")}>
            {hero.secondary}
          </a>
        </div>
      </div>
    </section>
  );
}
