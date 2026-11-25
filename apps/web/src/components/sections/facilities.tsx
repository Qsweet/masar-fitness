import Image, { type StaticImageData } from "next/image";
import type { ReactNode } from "react";
import { PHOTOS, type PhotoKey } from "@/config/photos";
import type { Dictionary } from "@/i18n/dictionaries";
import { cx } from "@/lib/cx";
import styles from "./facilities.module.css";

const CARD_SIZES = "(min-width: 64rem) 30vw, (min-width: 40rem) 50vw, 100vw";

/** صورة كل مرفق بترتيب القاموس (facilities.items): الحديد ثم التمارين الوظيفية. */
const ITEM_PHOTOS: readonly PhotoKey[] = ["legPress", "functionalSquat"];

interface CardProps {
  readonly id?: string;
  readonly photo: StaticImageData;
  readonly alt: string;
  readonly title: string;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}

function FacilityCard({ id, photo, alt, title, className, children }: CardProps) {
  return (
    <li id={id} className={cx(styles.card, className)}>
      <div className={styles.photo}>
        <Image src={photo} alt={alt} fill placeholder="blur" sizes={CARD_SIZES} />
      </div>
      <div className={styles.body}>
        <h3 className={styles.name}>{title}</h3>
        {children}
      </div>
    </li>
  );
}

/**
 * المرافق الخمسة في ثلاث بطاقات بصور حقيقية: الحديد، والتمارين الوظيفية، والاستشفاء (المسبح والجاكوزي
 * والبخار معًا، لأن الجاكوزي والبخار بلا صورة مؤكدة). بطاقة الاستشفاء تحمل المرساة ‎#water‎ التي تشير
 * إليها روابط المقالات، والأسماء نفسها في كل الموقع وفي مزايا الاشتراك.
 */
export function Facilities({ dictionary }: { readonly dictionary: Dictionary }) {
  const { facilities, photos } = dictionary;
  const { recovery } = facilities;
  return (
    <section
      id="facilities"
      className={cx("container", "section", styles.facilities)}
      aria-labelledby="facilities-title"
    >
      <div className="section-head">
        <h2 id="facilities-title" className="title-section">
          {facilities.title}
        </h2>
        <p>{facilities.lead}</p>
      </div>
      <ul className={styles.grid}>
        {facilities.items.map((item, index) => {
          const key = ITEM_PHOTOS[index];
          return key === undefined ? null : (
            <FacilityCard key={item.name} photo={PHOTOS[key]} alt={photos[key]} title={item.name}>
              <p>{item.line}</p>
            </FacilityCard>
          );
        })}
        <FacilityCard
          id="water"
          photo={PHOTOS.pool}
          alt={photos.pool}
          title={recovery.title}
          className={styles.recovery}
        >
          <ul className={styles.names}>
            {recovery.names.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
          <p>{recovery.line}</p>
        </FacilityCard>
      </ul>
    </section>
  );
}
