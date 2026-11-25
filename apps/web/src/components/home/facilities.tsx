import { SectionHead } from "@/components/ui/section-head";
import type { IconName } from "@/components/ui/icon";
import { ImageTile } from "@/components/ui/image-tile";
import { CLUB_FACTS } from "@/config/club-facts";
import { PHOTOS, type PhotoKey } from "@/config/photos";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/fill";
import { cx } from "@/lib/cx";
import styles from "./facilities.module.css";

/** البطاقة الأولى الكبيرة تأخذ عمودين على الشاشة الواسعة */
const CARD_SIZES = "(min-width: 64rem) 25vw, (min-width: 40rem) 50vw, 100vw";
const LEAD_SIZES = "(min-width: 64rem) 50vw, 100vw";

/**
 * عرض كل مرفق بترتيب القاموس (facilities.items): صورته من النادي، وأيقونة صف المعلومات، ومرساته.
 * ‎#water‎ تشير إليها روابط المقالات، والبقية تشير إليها بطاقات الأهداف. لا صورة للجاكوزي ولا للبخار،
 * فهما مع الساونا في بطاقة الاستشفاء بصورتها، لا بطاقة بلا صورة.
 */
export const FACILITY_ANCHORS = {
  weights: "weights",
  functional: "functional",
  classes: "classes",
  water: "water",
  recovery: "recovery",
} as const;

const ITEMS: readonly { photo: PhotoKey; meta: IconName; id: string }[] = [
  { photo: "dumbbellRacks", meta: "dumbbell", id: FACILITY_ANCHORS.weights },
  { photo: "functionalFront", meta: "dumbbell", id: FACILITY_ANCHORS.functional },
  { photo: "agilityFloor", meta: "users", id: FACILITY_ANCHORS.classes },
  { photo: "pool", meta: "waves", id: FACILITY_ANCHORS.water },
  { photo: "sauna", meta: "flame", id: FACILITY_ANCHORS.recovery },
];

/** المرافق في خمس بطاقات صور كاملة بشبكة غير متساوية: الأولى كبيرة، وكل بطاقة بشارة «ضمن الاشتراك». */
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
              <ImageTile
                key={item.name}
                id={view.id}
                className={index === 0 ? styles.lead : undefined}
                photo={{ src: PHOTOS[photo], alt: photos[photo] }}
                sizes={index === 0 ? LEAD_SIZES : CARD_SIZES}
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
