import { Icon } from "@/components/ui/icon";
import { SectionHead } from "@/components/ui/section-head";
import { QUOTED_REVIEWS, type QuotedReview } from "@/config/reviews";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/fill";
import { cx } from "@/lib/cx";
import type { RatingView } from "./home-view";
import styles from "./reviews.module.css";

/** نجوم للعين فقط؛ العدد مكتوب لقارئ الشاشة بجانبها. */
function Stars({ count, label }: { readonly count: number; readonly label: string }) {
  return (
    <span className={styles.stars}>
      <span aria-hidden="true">
        {Array.from({ length: count }, (_, index) => (
          <Icon key={index} name="star" />
        ))}
      </span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

function Rating({
  rating,
  dictionary,
}: {
  readonly rating: RatingView;
  readonly dictionary: Dictionary;
}) {
  const { reviews } = dictionary;
  return (
    <div className={cx("reveal", styles.rating)}>
      <p className={cx("accent-text", styles.ratingValue)}>{rating.value}</p>
      <div>
        <p className={styles.ratingLabel}>{reviews.ratingLabel}</p>
        <p>{rating.count}</p>
        <p className={styles.ratingSource}>{rating.source}</p>
      </div>
    </div>
  );
}

function Review({
  review,
  dictionary,
}: {
  readonly review: QuotedReview;
  readonly dictionary: Dictionary;
}) {
  const { reviews } = dictionary;
  return (
    <li className={cx("reveal", styles.card)}>
      <Stars count={review.stars} label={fill(reviews.stars, { stars: String(review.stars) })} />
      {/* النص بالعربية كما كُتب في Google، في اللغتين */}
      <blockquote lang="ar" dir="rtl" className={styles.quote}>
        <p>«{review.text}»</p>
      </blockquote>
      <p className={styles.author}>
        <bdi>{review.name}</bdi>
        <span>{reviews.source}</span>
      </p>
    </li>
  );
}

/** «النتائج» الصادقة: تقييم Google بمصدره وتاريخه، وآراء مقتبسة بنصها واسم صاحبها كما ظهرت. */
export function Reviews({
  dictionary,
  rating,
}: {
  readonly dictionary: Dictionary;
  readonly rating: RatingView;
}) {
  const { reviews } = dictionary;
  return (
    <section className={cx("section", "section-alt")} aria-labelledby="reviews-title">
      <div className="container">
        <SectionHead
          id="reviews-title"
          eyebrow={reviews.eyebrow}
          title={reviews.title}
          lead={reviews.lead}
        />
        <Rating rating={rating} dictionary={dictionary} />
        <ul className={styles.grid}>
          {QUOTED_REVIEWS.map((review) => (
            <Review key={review.name} review={review} dictionary={dictionary} />
          ))}
        </ul>
      </div>
    </section>
  );
}
