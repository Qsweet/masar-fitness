import Image from "next/image";
import { PHOTOS, type PhotoKey } from "@/config/photos";
import type { Dictionary } from "@/i18n/dictionaries";
import { cx } from "@/lib/cx";
import styles from "./story.module.css";

interface SectionProps {
  readonly dictionary: Dictionary;
}

/** صور التمرين: الأولى كبيرة، والاثنتان بجانبها. */
const TRAIN_SHOTS: readonly { key: PhotoKey; sizes: string }[] = [
  { key: "functionalPress", sizes: "(min-width: 64rem) 58vw, 100vw" },
  { key: "coachFloor", sizes: "(min-width: 64rem) 40vw, 50vw" },
  { key: "latPulldown", sizes: "(min-width: 64rem) 40vw, 50vw" },
];

/** التمرين بالألوان كما هو: ثلاث صور من يوم تمرين في النادي. */
export function Train({ dictionary }: SectionProps) {
  const { train, photos } = dictionary;
  return (
    <section id="train" className={cx("container", "section")} aria-labelledby="train-title">
      <div className="section-head">
        <h2 id="train-title" className="title-section">
          {train.title}
        </h2>
        <p>{train.lead}</p>
      </div>
      <div className={styles.mosaic}>
        {TRAIN_SHOTS.map(({ key, sizes }) => (
          <figure key={key} className={styles.shot}>
            <Image src={PHOTOS[key]} alt={photos[key]} fill placeholder="blur" sizes={sizes} />
          </figure>
        ))}
      </div>
    </section>
  );
}

/**
 * الثقة: نقاط قصيرة بجانب صور فريق النادي. لا أسماء ولا أدوار ولا شهادات لمن في الصور
 * (غير مؤكدة من المالك)، والنص البديل يصف ما يظهر فقط.
 */
export function Trust({ dictionary }: SectionProps) {
  const { trust, photos } = dictionary;
  return (
    <section className={cx("section", styles.trustWrap)} aria-labelledby="trust-title">
      <div className={cx("container", styles.trust)}>
        <div className={styles.trustText}>
          <h2 id="trust-title" className="title-section">
            {trust.title}
          </h2>
          <p className={styles.trustLead}>{trust.lead}</p>
          <ul className={styles.points}>
            {trust.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
        <figure className={styles.portrait}>
          <Image
            src={PHOTOS.trainerPortrait}
            alt={photos.trainerPortrait}
            fill
            placeholder="blur"
            sizes="(min-width: 64rem) 40vw, 100vw"
          />
        </figure>
        <figure className={styles.consultation}>
          <Image
            src={PHOTOS.consultation}
            alt={photos.consultation}
            fill
            placeholder="blur"
            sizes="(min-width: 64rem) 50vw, 100vw"
          />
        </figure>
      </div>
    </section>
  );
}
