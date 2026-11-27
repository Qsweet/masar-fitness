import Image from "next/image";
import { buttonClass } from "@/components/ui/button-link";
import { Icon } from "@/components/ui/icon";
import { HERO_VIDEO } from "@/config/media";
import { cx } from "@/lib/cx";
import type { Dictionary } from "@/i18n/dictionaries";
import { BackgroundVideo } from "./background-video";
import { VideoDialog } from "./video-dialog";
import styles from "./hero.module.css";

/** معرّف الواجهة. */
const HERO_ID = "top";
/** القسم التالي الذي ينزل إليه مؤشر التمرير */
export const HIGHLIGHTS_ID = "highlights";

/**
 * الواجهة بعرض الشاشة وارتفاعها: لقطات حقيقية من النادي خلف تظليل أسود، والعنوان الكبير بسطرين
 * (الثاني بالأصفر) في البداية، وسطر واحد، وفعلان: العضويات، ومشاهدة المقطع في حوار.
 * الصورة الثابتة هي عنصر LCP وتُحمَّل أولًا؛ الفيديو يُركَّب فوقها بعد التحميل.
 */
export function Hero({ dictionary }: { readonly dictionary: Dictionary }) {
  const { hero } = dictionary;
  return (
    <section id={HERO_ID} className={styles.hero} aria-labelledby="hero-title">
      <Image
        className={styles.poster}
        src={HERO_VIDEO.poster}
        alt=""
        fill
        preload
        placeholder="blur"
        sizes="100vw"
      />
      <BackgroundVideo video={HERO_VIDEO} labels={hero} />
      <div className={styles.scrim} aria-hidden="true" />
      <div className={cx("container", styles.inner)}>
        <p className={styles.place}>{hero.place}</p>
        <h1 id="hero-title" className={styles.title}>
          <span>{hero.title}</span> <span className={styles.slogan}>{hero.slogan}</span>
        </h1>
        <p className={styles.lead}>{hero.lead}</p>
        <div className={styles.actions}>
          <a href="#plans" className={buttonClass("primary")}>
            {hero.action}
            <Icon name="arrow" />
          </a>
          <VideoDialog video={HERO_VIDEO} labels={hero} />
        </div>
      </div>
      <a href={`#${HIGHLIGHTS_ID}`} className={styles.scroll}>
        <span>{hero.scroll}</span>
        <Icon name="down" />
      </a>
    </section>
  );
}
