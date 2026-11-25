import { ButtonLink, buttonClass, type ButtonVariant } from "@/components/ui/button-link";
import { Price } from "@/components/ui/price";
import type { Dictionary } from "@/i18n/dictionaries";
import type { MoneyParts } from "@/i18n/format";
import { cx } from "@/lib/cx";
import { completeDemoPayment } from "@/server/payments/actions";
import reviewStyles from "./order-review.module.css";
import panelStyles from "./payment-panel.module.css";

export interface DemoPayView {
  readonly sessionId: string;
  readonly reference: string;
  readonly amount: MoneyParts;
  /** الجلسة ما زالت تقبل الدفع. */
  readonly open: boolean;
  readonly backHref: string;
}

interface DemoPayProps {
  readonly view: DemoPayView;
  readonly labels: Dictionary["onlinePayment"]["demo"];
}

const OUTCOMES: readonly {
  key: keyof DemoPayProps["labels"]["outcomes"];
  variant: ButtonVariant;
}[] = [
  { key: "paid", variant: "ink" },
  { key: "failed", variant: "line" },
  { key: "mismatch", variant: "line" },
  { key: "pending", variant: "line" },
];

/**
 * صفحة الدفع التجريبية لمزوّد الاختبار: محاكاة صريحة لصفحة المزوّد المستضافة، بلا حقل بطاقة.
 * كل زر نموذج POST يسجّل نتيجة المحاكاة ثم يعيد إلى رابط العودة.
 */
export function DemoPay({ view, labels }: DemoPayProps) {
  return (
    <div className={cx("container", reviewStyles.review)}>
      <div className={reviewStyles.main}>
        <section aria-labelledby="demo-summary" className={reviewStyles.panel}>
          <h2 id="demo-summary" className={reviewStyles.panelTitle}>
            {labels.summary}
          </h2>
          <dl className={reviewStyles.facts}>
            <div>
              <dt>{labels.reference}</dt>
              <dd dir="ltr">{view.reference}</dd>
            </div>
            <div>
              <dt>{labels.amount}</dt>
              <dd data-testid="demo-amount">
                <Price parts={view.amount} />
              </dd>
            </div>
          </dl>
        </section>
        <section
          aria-labelledby="demo-outcomes"
          className={reviewStyles.panel}
          data-testid="demo-session"
          data-session={view.sessionId}
        >
          <h2 id="demo-outcomes" className={reviewStyles.panelTitle}>
            {labels.outcomesTitle}
          </h2>
          {view.open ? null : <p>{labels.closed}</p>}
          <div className={panelStyles.actions}>
            {view.open
              ? OUTCOMES.map(({ key, variant }) => (
                  <form key={key} action={completeDemoPayment}>
                    <input type="hidden" name="session" value={view.sessionId} />
                    <input type="hidden" name="outcome" value={key} />
                    <button type="submit" className={buttonClass(variant, true)}>
                      {labels.outcomes[key]}
                    </button>
                  </form>
                ))
              : null}
            <ButtonLink href={view.backHref} variant="line" external block>
              {labels.back}
            </ButtonLink>
          </div>
        </section>
      </div>
    </div>
  );
}
