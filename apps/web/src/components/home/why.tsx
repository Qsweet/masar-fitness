import { IconTile, type IconName } from "@/components/ui/icon";
import { SectionHead } from "@/components/ui/section-head";
import { CLUB_FACTS } from "@/config/club-facts";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/fill";
import { cx } from "@/lib/cx";
import type { HoursRow } from "./hours-view";
import styles from "./why.module.css";

/** أيقونة كل سبب بترتيب القاموس (why.items). */
const ICONS: readonly IconName[] = ["clock", "sparkle", "award", "snowflake"];

/** قسم أسود: أربعة أسباب بأيقونات صفراء، والأوقات وأيام التجميد من config لا من النص. */
export function Why({
  dictionary,
  weekday,
}: {
  readonly dictionary: Dictionary;
  readonly weekday: HoursRow;
}) {
  const { why } = dictionary;
  const values = {
    opens: weekday.opens,
    closes: weekday.closes,
    days: String(CLUB_FACTS.freezeDaysPerPaidMonth),
  };
  return (
    <section className={cx("section", "on-ink", styles.why)} aria-labelledby="why-title">
      <div className="container">
        <SectionHead id="why-title" eyebrow={why.eyebrow} title={why.title} lead={why.lead} />
        <ul className={styles.grid}>
          {why.items.map((item, index) => (
            <li key={item.title} className="reveal">
              <IconTile name={ICONS[index] ?? "check"} className={styles.tile} />
              <h3 className={styles.title}>{item.title}</h3>
              <p>{fill(item.line, values)}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
