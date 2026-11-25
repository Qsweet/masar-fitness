import { ImageTile } from "@/components/ui/image-tile";
import { SectionHead } from "@/components/ui/section-head";
import { CLUB_FACTS } from "@/config/club-facts";
import { PHOTOS, type PhotoKey } from "@/config/photos";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/fill";
import { FACILITY_ANCHORS } from "./facilities";
import styles from "./goals.module.css";

const CARD_SIZES = "(min-width: 64rem) 25vw, 50vw";

/**
 * صورة كل هدف ووجهته بترتيب القاموس (goals.items): خسارة الوزن إلى الحصص الجماعية (مجموعة حقيقية)، وبناء
 * العضلات إلى صالة الحديد (صف البنش)، والتأهيل إلى البرامج (تأهيل الإصابات، حديث مع مختص)، ورفع اللياقة إلى
 * التمارين الوظيفية (رفع البار). لا تقييم ولا وعد طبي.
 */
const GOALS: readonly { photo: PhotoKey; anchor: string }[] = [
  { photo: "functionalSquat", anchor: FACILITY_ANCHORS.classes },
  { photo: "benchRow", anchor: FACILITY_ANCHORS.weights },
  { photo: "consultation", anchor: "services" },
  { photo: "functionalPress", anchor: FACILITY_ANCHORS.functional },
];

/** «ما هو هدفك الرياضي؟»: أربع بطاقات صور، كل منها رابط إلى ما يخدم الهدف في الصفحة نفسها. */
export function Goals({ dictionary }: { readonly dictionary: Dictionary }) {
  const { goals, photos } = dictionary;
  return (
    <section id="goals" className="section" aria-labelledby="goals-title">
      <div className="container">
        <SectionHead
          id="goals-title"
          eyebrow={goals.eyebrow}
          title={goals.title}
          lead={goals.lead}
        />
        <ul className={styles.grid}>
          {goals.items.map((item, index) => {
            const goal = GOALS[index];
            if (goal === undefined) {
              return null;
            }
            return (
              <ImageTile
                key={item.title}
                className={styles.card}
                photo={{ src: PHOTOS[goal.photo], alt: photos[goal.photo] }}
                sizes={CARD_SIZES}
                title={item.title}
                line={fill(item.line, { count: String(CLUB_FACTS.machinesOver) })}
                link={{ href: `#${goal.anchor}`, label: goals.more }}
              />
            );
          })}
        </ul>
      </div>
    </section>
  );
}
