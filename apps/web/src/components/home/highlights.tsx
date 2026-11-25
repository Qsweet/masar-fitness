import { BidiText } from "@/components/ui/bidi-text";
import { Icon, type IconName } from "@/components/ui/icon";
import type { Dictionary } from "@/i18n/dictionaries";
import { cx } from "@/lib/cx";
import { HIGHLIGHTS_ID } from "./hero/hero";
import styles from "./highlights.module.css";

/** أيقونة كل ميزة بترتيب القاموس (highlights.items). */
const ICONS: readonly IconName[] = ["dumbbell", "shield", "waves", "users", "pin"];

/** صف المزايا الخمس تحت الواجهة بفواصل رفيعة بينها: أيقونة صفراء وعنوان وسطر. */
export function Highlights({ dictionary }: { readonly dictionary: Dictionary }) {
  const { highlights } = dictionary;
  return (
    <section id={HIGHLIGHTS_ID} className={styles.band} aria-labelledby="highlights-title">
      <h2 id="highlights-title" className="sr-only">
        {highlights.title}
      </h2>
      <ul className={cx("container", styles.list)}>
        {highlights.items.map((item, index) => (
          <li key={item.title} className={styles.item}>
            <Icon name={ICONS[index] ?? "check"} className={styles.icon} />
            <span>
              <strong className={styles.title}>{item.title}</strong>
              <span className={styles.line}>
                <BidiText text={item.line} />
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
