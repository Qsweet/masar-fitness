import Image from "next/image";
import { LoopVideo } from "@/components/ui/loop-video";
import { PHOTOS, type PhotoKey } from "@/config/photos";
import type { Dictionary } from "@/i18n/dictionaries";
import { cx } from "@/lib/cx";
import styles from "./story.module.css";

/** صورتا التمرين: الأولى كبيرة، والثانية بجانبها فوق المقطع الصامت. */
const TRAIN_SHOTS: readonly { key: PhotoKey; sizes: string }[] = [
  { key: "functionalFront", sizes: "(min-width: 64rem) 58vw, 100vw" },
  { key: "coachFloor", sizes: "(min-width: 64rem) 40vw, 50vw" },
];

/**
 * التمرين بالألوان كما هو: صورتان من يوم تمرين في النادي ومقطع صامت من أرضيته (خلفية بصرية فقط،
 * لا يُذكر في أي نص أن الحصص الجماعية ضمن الاشتراك).
 */
export function Train({ dictionary }: { readonly dictionary: Dictionary }) {
  const { train, photos, media } = dictionary;
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
        <LoopVideo
          posterAlt={photos.videoPoster}
          pauseLabel={media.pauseVideo}
          playLabel={media.playVideo}
          className={styles.shot}
          sizes="(min-width: 64rem) 40vw, 50vw"
        />
      </div>
    </section>
  );
}
