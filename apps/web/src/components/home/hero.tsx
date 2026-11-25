import Image from "next/image";
import { buttonClass } from "@/components/ui/button-link";
import { Icon, IconTile, type IconName } from "@/components/ui/icon";
import { CLUB_FACTS } from "@/config/club-facts";
import { PHOTOS } from "@/config/photos";
import type { Dictionary } from "@/i18n/dictionaries";
import { cx } from "@/lib/cx";
import type { HoursRow } from "./hours-view";
import type { OfferView, RatingView } from "./home-view";
import styles from "./hero.module.css";

/** معرّف الواجهة. */
const HERO_ID = "top";
/** معرّف فعلَي الواجهة: شريط الشراء الثابت يظهر بعد أن يغادرا الشاشة. */
export const HERO_ACTIONS_ID = "hero-actions";

interface HeroProps {
  readonly dictionary: Dictionary;
  readonly offer: OfferView | undefined;
  readonly rating: RatingView;
  readonly weekday: HoursRow;
}

interface Stat {
  readonly icon: IconName;
  readonly value: string;
  readonly label: string;
}

function Stats({ dictionary, rating }: Pick<HeroProps, "dictionary" | "rating">) {
  const { hero } = dictionary;
  const stats: Stat[] = [
    { icon: "award", value: String(CLUB_FACTS.foundedYear), label: hero.founded },
    { icon: "star", value: rating.value, label: hero.rating },
    { icon: "person", value: `${String(CLUB_FACTS.minimumAge)}+`, label: hero.menOnly },
  ];
  return (
    <ul className={styles.stats}>
      {stats.map((stat) => (
        <li key={stat.label}>
          <IconTile name={stat.icon} />
          <span>
            <strong dir="ltr">{stat.value}</strong>
            <span>{stat.label}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** الصورة الكبيرة بتوهّج دافئ، وشارتان عائمتان على زاويتيها: مكافأة الاشتراك الأوفر، وساعات العمل. */
function Visual({ dictionary, offer, weekday }: Omit<HeroProps, "rating">) {
  return (
    <div className={styles.visual}>
      <div className={styles.photo}>
        <Image
          src={PHOTOS.functionalPress}
          alt={dictionary.photos.functionalPress}
          fill
          preload
          placeholder="blur"
          sizes="(min-width: 64rem) 46vw, 100vw"
        />
      </div>
      {offer === undefined ? null : (
        <p className={styles.offer}>
          <strong>{offer.title}</strong>
          <span>{offer.line}</span>
        </p>
      )}
      <p className={styles.since}>
        <IconTile name="clock" />
        <span>
          <span>{weekday.days}</span>
          <strong>{weekday.range}</strong>
        </span>
      </p>
    </div>
  );
}

/**
 * الواجهة: شارة صغيرة، ثم العنوان h1 بسطرين (اسم النادي بالفصحى، وشعار الجدار «أنت قدها.» بالتدرّج)،
 * والسطر التعريفي والفعلان وثلاث رقائق حقائق. بجانبها صورة من النادي (عنصر LCP المحمَّل مسبقًا).
 */
export function Hero(props: HeroProps) {
  const { hero } = props.dictionary;
  return (
    <section id={HERO_ID} className={styles.hero} aria-labelledby="hero-title">
      <div className={cx("container", styles.inner)}>
        <div className={styles.text}>
          <p className={styles.badge}>
            <Icon name="sparkle" />
            {hero.badge}
          </p>
          <h1 id="hero-title" className={styles.title}>
            <span className={styles.name}>{hero.title}</span>{" "}
            <span className={cx("gradient-text", styles.slogan)}>{hero.slogan}</span>
          </h1>
          <p className={styles.lead}>{hero.lead}</p>
          <div id={HERO_ACTIONS_ID} className={styles.actions}>
            <a href="#plans" className={buttonClass("primary")}>
              {hero.action}
              <Icon name="arrow" />
            </a>
            <a href="#facilities" className={buttonClass("outline")}>
              {hero.secondary}
            </a>
          </div>
          <Stats dictionary={props.dictionary} rating={props.rating} />
        </div>
        <Visual dictionary={props.dictionary} offer={props.offer} weekday={props.weekday} />
      </div>
      <span className={styles.scroll} aria-hidden="true" />
    </section>
  );
}
