import Image from "next/image";
import { BidiText } from "@/components/ui/bidi-text";
import { IconTile, type IconName } from "@/components/ui/icon";
import { SectionHead } from "@/components/ui/section-head";
import { CLUB_FACTS } from "@/config/club-facts";
import { PHOTOS } from "@/config/photos";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/fill";
import { cx } from "@/lib/cx";
import styles from "./about.module.css";

/** أيقونة كل ميزة بترتيب القاموس (about.features). */
const FEATURE_ICONS: readonly IconName[] = ["dumbbell", "users", "waves", "flame"];

/**
 * «من نحن»: صورة مستديرة ببطاقة رقم عائمة بالتدرّج (عدد الأجهزة كما يذكره الموقع الحالي)، وبجانبها
 * العنوان والفقرتان وأربع مزايا بأيقونات.
 */
export function About({ dictionary }: { readonly dictionary: Dictionary }) {
  const { about, photos } = dictionary;
  return (
    <section id="about" className="section" aria-labelledby="about-title">
      <div className={cx("container", styles.inner)}>
        <div className={cx("reveal", styles.visual)}>
          <div className={styles.photo}>
            <Image
              src={PHOTOS.coachFloor}
              alt={photos.coachFloor}
              fill
              placeholder="blur"
              sizes="(min-width: 64rem) 45vw, 100vw"
            />
          </div>
          <p className={styles.stat}>
            <strong dir="ltr">
              {fill(about.statValue, { count: String(CLUB_FACTS.machinesOver) })}
            </strong>
            <span>{about.statLabel}</span>
          </p>
        </div>
        <div className={styles.text}>
          <SectionHead id="about-title" eyebrow={about.eyebrow} title={about.title} start />
          {about.paragraphs.map((paragraph) => (
            <p key={paragraph} className={styles.paragraph}>
              <BidiText text={fill(paragraph, { year: String(CLUB_FACTS.foundedYear) })} />
            </p>
          ))}
          <ul className={styles.features}>
            {about.features.map((feature, index) => (
              <li key={feature.title}>
                <IconTile name={FEATURE_ICONS[index] ?? "check"} />
                <span>
                  <strong>{feature.title}</strong>
                  <span>
                    <BidiText text={feature.line} />
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
