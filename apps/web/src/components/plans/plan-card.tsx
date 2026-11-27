import { buttonClass } from "@/components/ui/button-link";
import { Icon, type IconName } from "@/components/ui/icon";
import type { Dictionary } from "@/i18n/dictionaries";
import { cx } from "@/lib/cx";
import { MonthStrip } from "./month-strip";
import { PurchaseButton } from "./purchase-button";
import type { PlanView } from "./plan-view";
import { RollingPrice } from "./rolling-price";
import styles from "./plan-card.module.css";

export interface PlanCardProps {
  /** كل الاشتراكات بترتيب المبدّل: لكل منها نسخة في البطاقة، والظاهرة المختارة (CSS) */
  readonly plans: readonly PlanView[];
  readonly activeSlug: string;
  /** مبلغ الاختيار السابق ليدور منه السعر؛ غائب أول مرة */
  readonly previousAmount?: string | undefined;
  readonly labels: Dictionary["plans"];
  readonly planLabels: Dictionary["plan"];
  /** منطقة زر الشراء: شريط الجوال الثابت يختفي ما دامت ظاهرة */
  readonly actionsId?: string | undefined;
  /**
   * بعد الترطيب: النسخ غير المختارة `inert` فوق إخفائها، فلا يصلها Tab ولا النقر في أي لحظة من
   * التبديل. قبله لا (بلا JavaScript يبدّل CSS وحده النسخة الظاهرة، و`inert` كان سيعطّلها).
   */
  readonly inertInactive?: boolean | undefined;
}

type VariantProps = Pick<PlanCardProps, "labels" | "planLabels"> & {
  readonly plan: PlanView;
  readonly active: boolean;
  readonly inert: boolean;
  readonly previousAmount: string | undefined;
};

/** هوية الاشتراك وسعره: الاسم، الإجمالي الدوّار، اليومي والشهري، شريط الأشهر، والمقارنة. */
function PlanFacts({ plan, active, previousAmount }: VariantProps) {
  return (
    <div
      className={styles.facts}
      data-variant
      data-plan={plan.slug}
      data-active={active ? "" : undefined}
    >
      <p className={styles.titles}>
        <span className={styles.tier}>{plan.tier ?? plan.name}</span>
        {plan.tier === undefined ? null : <span className={styles.name}>{plan.name}</span>}
      </p>
      <p className={styles.price}>
        <RollingPrice
          parts={plan.price}
          from={previousAmount}
          active={active}
          unitClassName={styles.unit}
        />
      </p>
      <p className={styles.figures}>
        <span className={styles.perDay}>{plan.dailyText}</span>
        {plan.monthlyText === undefined ? null : <span>{plan.monthlyText}</span>}
      </p>
      {plan.strip === undefined ? (
        <p className={styles.duration}>{plan.durationText}</p>
      ) : (
        <MonthStrip
          strip={plan.strip}
          paidText={plan.term}
          freeText={plan.bonusText}
          label={plan.durationText}
        />
      )}
      {plan.savingsText === undefined ? null : <p className={styles.savings}>{plan.savingsText}</p>}
    </div>
  );
}

/** زر الشراء داخل البطاقة، وتحته واتساب (أو سطر الشراء المغلق) ورابط صفحة الاشتراك. */
function PlanActions({ plan, active, inert, labels, planLabels }: VariantProps) {
  const viaWhatsapp = plan.purchase.kind === "whatsapp";
  return (
    <div
      className={styles.actions}
      inert={inert}
      data-variant
      data-plan={plan.slug}
      data-active={active ? "" : undefined}
    >
      <PurchaseButton purchase={plan.purchase} className={cx(buttonClass("primary"), styles.buy)}>
        {viaWhatsapp ? planLabels.buyWhatsapp : planLabels.buyOnline}
        <Icon name="arrow" />
      </PurchaseButton>
      {viaWhatsapp ? <p className={styles.note}>{planLabels.buyNote}</p> : null}
      <p className={styles.links}>
        {viaWhatsapp ? null : (
          <a href={plan.whatsappHref} rel="noopener noreferrer">
            {planLabels.whatsappAlternative}
          </a>
        )}
        <a href={plan.href}>
          {labels.details}
          <span className="sr-only">: {plan.name}</span>
        </a>
      </p>
    </div>
  );
}

function Feature({ icon, children }: { readonly icon: IconName; readonly children: string }) {
  return (
    <li>
      <span className={styles.featureIcon} aria-hidden="true">
        <Icon name={icon} />
      </span>
      {children}
    </li>
  );
}

/**
 * المزايا مرة واحدة: سطر التجميد وحده يتغير بالاشتراك (نسخة لكل اشتراك في المكان نفسه)، و«يشمل
 * جميع المرافق» حين تتطابق مزايا كل الاشتراكات (محسوب)، وبدء الاشتراك من التفعيل.
 */
function Features({
  plans,
  activeSlug,
  labels,
}: Pick<PlanCardProps, "plans" | "activeSlug" | "labels">) {
  return (
    <ul className={styles.features}>
      <li>
        <span className={styles.featureIcon} aria-hidden="true">
          <Icon name="snowflake" />
        </span>
        <span className={styles.stack}>
          {plans.map((plan) => (
            <span
              key={plan.slug}
              data-variant
              data-plan={plan.slug}
              data-active={plan.slug === activeSlug ? "" : undefined}
            >
              {plan.freezeText}
            </span>
          ))}
        </span>
      </li>
      {plans[0]?.benefitsShared === true ? (
        <Feature icon="dumbbell">{labels.includesAll}</Feature>
      ) : null}
      <Feature icon="calendar">{labels.startsOnActivation}</Feature>
    </ul>
  );
}

/**
 * البطاقة الكبيرة الواحدة: في كل منطقة متغيرة نسخة لكل اشتراك في الخلية نفسها، والظاهرة نسخة
 * المختار بقاعدة CSS على الراديو (`plan-picker.module.css`)، فتتبدّل بانتقال ناعم وتعمل بلا
 * JavaScript، وارتفاع البطاقة ثابت بين الاشتراكات. اشتراك واحد (معاينة اللوحة) يظهر وحده.
 */
export function PlanCard(props: PlanCardProps) {
  const { plans, activeSlug, previousAmount, labels, planLabels, actionsId } = props;
  const variant = (plan: PlanView) => ({
    plan,
    active: plan.slug === activeSlug,
    inert: props.inertInactive === true && plan.slug !== activeSlug,
    previousAmount,
    labels,
    planLabels,
  });
  return (
    <div className={styles.frame}>
      <article className={styles.card} data-plan-card>
        <div className={cx(styles.main, styles.stack)}>
          {plans.map((plan) => (
            <PlanFacts key={plan.slug} {...variant(plan)} />
          ))}
        </div>
        <div className={styles.side}>
          <Features plans={plans} activeSlug={activeSlug} labels={labels} />
          <div className={styles.stack} id={actionsId}>
            {plans.map((plan) => (
              <PlanActions key={plan.slug} {...variant(plan)} />
            ))}
          </div>
        </div>
      </article>
    </div>
  );
}
