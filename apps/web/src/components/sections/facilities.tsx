import Image from "next/image";
import { PHOTOS, type PhotoKey } from "@/config/photos";
import type { Dictionary } from "@/i18n/dictionaries";
import { cx } from "@/lib/cx";
import styles from "./facilities.module.css";

/**
 * صورة كل مرفق بترتيب القاموس (facilities.items). الجاكوزي والبخار بلا صورة مؤكدة من المالك،
 * فيظهران مربعين نصيين بالبنية نفسها.
 */
const FACILITY_PHOTOS: readonly PhotoKey[] = ["legPress", "functionalSquat", "pool"];
/** موضع المسبح: يحمل المرساة ‎#water‎ التي تشير إليها روابط المقالات. */
const POOL_INDEX = 2;

/** المرافق الخمسة: ثلاثة بصورها الحقيقية واثنان نصًا، سطر واحد لكل مرفق وبالأسماء نفسها في كل الموقع. */
export function Facilities({ dictionary }: { readonly dictionary: Dictionary }) {
  const { facilities, photos } = dictionary;
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
          const photo = FACILITY_PHOTOS[index];
          return (
            <li
              key={item.name}
              id={index === POOL_INDEX ? "water" : undefined}
              className={photo === undefined ? styles.textCard : styles.photoCard}
            >
              {photo === undefined ? null : (
                <div className={styles.photo}>
                  <Image
                    src={PHOTOS[photo]}
                    alt={photos[photo]}
                    fill
                    placeholder="blur"
                    sizes="(min-width: 64rem) 30vw, (min-width: 40rem) 50vw, 100vw"
                  />
                </div>
              )}
              <div className={styles.body}>
                <h3 className={styles.name}>{item.name}</h3>
                <p>{item.line}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
