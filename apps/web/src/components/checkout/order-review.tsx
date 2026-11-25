import { ButtonLink } from "@/components/ui/button-link";
import type { Dictionary } from "@/i18n/dictionaries";
import { cx } from "@/lib/cx";
import type { ReviewView } from "./review-view";
import { LineList, Totals } from "./totals";
import summaryStyles from "./quote-summary.module.css";
import styles from "./order-review.module.css";

interface OrderReviewProps {
  readonly view: ReviewView;
  readonly labels: Dictionary["checkout"];
}

function Buyer({ view, labels }: OrderReviewProps) {
  const { review } = labels;
  return (
    <section aria-labelledby="buyer-title" className={styles.panel}>
      <h2 id="buyer-title" className={styles.panelTitle}>
        {review.buyer}
      </h2>
      <dl className={styles.facts}>
        <div>
          <dt>{review.name}</dt>
          <dd>{view.customerName}</dd>
        </div>
        <div>
          <dt>{review.mobile}</dt>
          <dd dir="ltr">{view.maskedPhone}</dd>
        </div>
        <div>
          <dt>{review.status}</dt>
          <dd>
            <span className={styles.status}>{view.statusText}</span>
          </dd>
        </div>
      </dl>
      {view.deadline === undefined ? null : <p className={styles.deadline}>{view.deadline}</p>}
    </section>
  );
}

/** الخطوة التالية بصدق: لا زر دفع ولا محاكاة. المعلّق واتساب برقم الطلب، والمنتهي بدء جديد. */
function NextStep({ view, labels }: OrderReviewProps) {
  const { review } = labels;
  if (view.state === "expired") {
    return (
      <section aria-labelledby="next-title" className={styles.panel}>
        <h2 id="next-title" className={styles.panelTitle}>
          {review.nextTitle}
        </h2>
        <ButtonLink href={view.restartHref}>{review.startAgain}</ButtonLink>
      </section>
    );
  }
  return (
    <section aria-labelledby="next-title" className={styles.panel}>
      <h2 id="next-title" className={styles.panelTitle}>
        {review.nextTitle}
      </h2>
      {view.state === "pending" ? <p>{review.paymentUnavailable}</p> : null}
      <ButtonLink href={view.whatsappHref} external>
        {review.whatsapp}
      </ButtonLink>
    </section>
  );
}

function Lines({ view, labels }: OrderReviewProps) {
  return (
    <section aria-labelledby="lines-title" className={summaryStyles.summary}>
      <h2 id="lines-title" className={summaryStyles.title}>
        {labels.review.lines}
      </h2>
      <LineList
        lines={view.lines}
        renderExtra={(line) => (
          <>
            {line.benefits.length === 0 ? null : (
              <span className={summaryStyles.benefits}>
                {labels.review.includes}: {line.benefits.join(" / ")}
              </span>
            )}
            {line.startRule === undefined ? null : (
              <span className={summaryStyles.note}>{line.startRule}</span>
            )}
          </>
        )}
      />
      <Totals discounts={view.discounts} totals={view.totals} labels={labels.summary} />
    </section>
  );
}

/** مراجعة الطلب من لقطته: رقم الطلب أولًا، ثم البيانات والخطوة التالية، والتفاصيل بجانبها. */
export function OrderReview(props: OrderReviewProps) {
  const { view, labels } = props;
  return (
    <div className={cx("container", styles.review)}>
      <div className={styles.main}>
        <p className={styles.reference}>
          <span className={styles.referenceLabel}>{labels.review.reference}</span>
          <span className={styles.referenceValue} dir="ltr" data-testid="order-reference">
            {view.reference}
          </span>
        </p>
        <Buyer {...props} />
        <NextStep {...props} />
      </div>
      <Lines {...props} />
    </div>
  );
}
