import { SectionHead } from "@/components/ui/section-head";
import type { IconName } from "@/components/ui/icon";
import { PhotoCard } from "@/components/ui/photo-card";
import { CLUB_FACTS } from "@/config/club-facts";
import { PHOTOS, type PhotoKey } from "@/config/photos";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/fill";
import { cx } from "@/lib/cx";
import styles from "./card-grid.module.css";

const CARD_SIZES = "(min-width: 64rem) 30vw, (min-width: 40rem) 50vw, 100vw";

/**
 * عرض كل مرفق بترتيب القاموس (facilities.items): صورته من النادي أو أيقونته حين لا صورة مؤكدة
 * (الجاكوزي والبخار)، وأيقونة صف المعلومات، ومرساة المسبح ‎#water‎ التي تشير إليها روابط المقالات.
 */
const ITEMS: readonly { photo: PhotoKey | IconName; meta: IconName; id?: string }[] = [
  { photo: "legPress", meta: "dumbbell" },
  { photo: "functionalFront", meta: "dumbbell" },
  { photo: "functionalSquat", meta: "users" },
  { photo: "pool", meta: "waves", id: "water" },
  { photo: "sauna", meta: "flame" },
  { photo: "steam", meta: "waves" },
];

function isPhoto(key: PhotoKey | IconName): key is PhotoKey {
  return Object.hasOwn(PHOTOS, key);
}

/** المرافق السبعة في ست بطاقات بنمط البرامج: صورة، اسم، سطر، وصف معلومات بشارة «ضمن الاشتراك». */
export function Facilities({ dictionary }: { readonly dictionary: Dictionary }) {
  const { facilities, photos } = dictionary;
  const values = {
    count: String(CLUB_FACTS.machinesOver),
    min: CLUB_FACTS.poolDepthMeters.min,
    max: CLUB_FACTS.poolDepthMeters.max,
  };
  return (
    <section
      id="facilities"
      className={cx("section", "section-alt")}
      aria-labelledby="facilities-title"
    >
      <div className="container">
        <SectionHead
          id="facilities-title"
          eyebrow={facilities.eyebrow}
          title={facilities.title}
          lead={facilities.lead}
        />
        <ul className={styles.grid}>
          {facilities.items.map((item, index) => {
            const view = ITEMS[index];
            if (view === undefined) {
              return null;
            }
            const { photo } = view;
            return (
              <PhotoCard
                key={item.name}
                id={view.id}
                photo={isPhoto(photo) ? { src: PHOTOS[photo], alt: photos[photo] } : photo}
                sizes={CARD_SIZES}
                title={item.name}
                line={fill(item.line, values)}
                meta={{ icon: view.meta, text: fill(item.meta, values) }}
                badge={facilities.included}
              />
            );
          })}
        </ul>
      </div>
    </section>
  );
}
