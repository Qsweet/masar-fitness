import { CLUB_FACTS, GOOGLE_RATING } from "@/config/club-facts";
import { formatDate } from "@/i18n/dates";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/fill";
import { formatNumber } from "@/i18n/format";
import type { Locale } from "@/i18n/locales";
import type { RatingView } from "./home-view";
import styles from "./stats.module.css";

interface StatsProps {
  readonly locale: Locale;
  readonly dictionary: Dictionary;
  readonly rating: RatingView;
}

/**
 * شريط الأرقام: حقائق من موقع النادي الحالي فقط (docs/CLUB_FACTS.md): سنة التأسيس، وتقييم Google وعدد
 * مراجعاته بمصدرهما وتاريخ قراءتهما، وعدد أجهزة صالة الحديد. لا أعداد أعضاء ولا مدربين غير مؤكدة.
 */
export function Stats({ locale, dictionary, rating }: StatsProps) {
  const { stats, about } = dictionary;
  const items = [
    { value: String(CLUB_FACTS.foundedYear), label: stats.founded },
    { value: rating.value, label: stats.rating },
    { value: formatNumber(GOOGLE_RATING.count), label: stats.reviews },
    {
      value: fill(about.statValue, { count: String(CLUB_FACTS.machinesOver) }),
      label: stats.machines,
    },
  ];
  return (
    <section className={styles.band} aria-labelledby="stats-title">
      <div className="container">
        <h2 id="stats-title" className="sr-only">
          {stats.title}
        </h2>
        <dl className={styles.list}>
          {items.map((item) => (
            <div key={item.label} className={styles.item}>
              <dt className={styles.label}>{item.label}</dt>
              <dd className={styles.value} dir="ltr">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
        <p className={styles.source}>
          {fill(stats.source, { date: formatDate(GOOGLE_RATING.readOn, locale) })}
        </p>
      </div>
    </section>
  );
}
