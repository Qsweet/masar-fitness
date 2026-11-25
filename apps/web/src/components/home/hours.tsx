import { IconTile } from "@/components/ui/icon";
import { SectionHead } from "@/components/ui/section-head";
import type { HoursArea } from "@/config/hours";
import type { Dictionary } from "@/i18n/dictionaries";
import { cx } from "@/lib/cx";
import { hoursRows } from "./hours-view";
import styles from "./hours.module.css";

const AREAS: readonly { area: HoursArea; icon: "dumbbell" | "waves" }[] = [
  { area: "club", icon: "dumbbell" },
  { area: "pool", icon: "waves" },
];

/**
 * أوقات العمل مكان جدول الحصص في المرجع (لا جدول حصص منشور): لوحان أبيضان برأس أصفر على القسم الأسود، النادي والمسبح،
 * وجدول حقيقي لكل منهما. ساعات رمضان غير مذكورة في الموقع الحالي فلا تُعرض.
 */
export function Hours({ dictionary }: { readonly dictionary: Dictionary }) {
  const { hours } = dictionary;
  return (
    <section id="hours" className={cx("section", "on-ink")} aria-labelledby="hours-title">
      <div className="container">
        <SectionHead
          id="hours-title"
          eyebrow={hours.eyebrow}
          title={hours.title}
          lead={hours.lead}
        />
        <div className={styles.boards}>
          {AREAS.map(({ area, icon }) => (
            <table key={area} className={cx("reveal", styles.board)}>
              <caption className={styles.caption}>
                <IconTile name={icon} className={styles.tile} />
                {hours[area]}
              </caption>
              <tbody>
                {hoursRows(area, dictionary).map((row) => (
                  <tr key={row.days}>
                    <th scope="row">{row.days}</th>
                    <td>{row.range}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
        <ul className={styles.notes}>
          <li>{hours.poolNote}</li>
          <li>{hours.holidayNote}</li>
        </ul>
      </div>
    </section>
  );
}
