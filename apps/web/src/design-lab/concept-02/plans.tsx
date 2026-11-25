import type { LabPlan } from "../data";
import { cx } from "../cx";
import { fill } from "../text";
import { C2 } from "./copy";
import styles from "./c2.module.css";

/** يفصل «12 شهرًا» إلى رقم ووحدة؛ «شهر» و«شهران» كلمة وحدها. */
function splitDuration(label: string): { readonly count: string; readonly unit: string } {
  const [first = "", ...rest] = label.split(" ");
  return rest.length === 0 ? { count: first, unit: "" } : { count: first, unit: rest.join(" ") };
}

/** المنتج البطل: الباقة الأوفر شهريًا على كتلة صفراء، ورقمها بحجم ملصق. */
function Hero({ plan }: { readonly plan: LabPlan }) {
  const { count } = splitDuration(plan.durationLabel);
  return (
    <article className={styles.dropHero} aria-labelledby={`c2-${plan.slug}`}>
      <p className={styles.dropFlag}>{C2.plans.bestValue}</p>
      <p className={styles.dropNumber} aria-hidden="true">
        {count}
        {plan.bonusMonths > 0 ? <span className={styles.dropPlus}>+{plan.bonusMonths}</span> : null}
      </p>
      <h3 id={`c2-${plan.slug}`} className={styles.dropName}>
        {plan.name}: {plan.durationLabel}
        {plan.bonusLabel === undefined ? null : (
          <span> {fill(C2.plans.bonus, { bonus: plan.bonusLabel })}</span>
        )}
      </h3>
      <p className={styles.dropPrice}>
        <bdi>{plan.price.amount}</bdi> <span>{plan.price.unit}</span>
      </p>
      {plan.monthly === undefined ? null : (
        <p className={styles.dropMonthly}>
          {fill(C2.plans.monthly, { amount: plan.monthly.amount, unit: plan.monthly.unit })}
        </p>
      )}
      <a href={plan.href} className={styles.dropCta}>
        {C2.plans.choose}
      </a>
    </article>
  );
}

function LineupItem({ plan }: { readonly plan: LabPlan }) {
  const { count, unit } = splitDuration(plan.durationLabel);
  return (
    <li>
      <a href={plan.href} className={styles.lineupItem}>
        <span className={cx(styles.lineupNumber, unit === "" && styles.lineupWord)}>{count}</span>
        <span className={styles.lineupText}>
          <span className={styles.lineupName}>{plan.name}</span>
          {unit === "" ? null : <span className={styles.lineupUnit}>{plan.durationLabel}</span>}
          {plan.bonusLabel === undefined ? null : (
            <span className={styles.lineupBonus}>
              {fill(C2.plans.bonus, { bonus: plan.bonusLabel })}
            </span>
          )}
        </span>
        <span className={styles.lineupPrice}>
          <bdi>{plan.price.amount}</bdi> {plan.price.unit}
        </span>
      </a>
    </li>
  );
}

/** «الإصدار»: باقة بطلة على الأصفر، وبقية المدد تشكيلة سوداء بجانبها. */
export function Plans({
  plans,
  best,
}: {
  readonly plans: readonly LabPlan[];
  readonly best: LabPlan | undefined;
}) {
  const hero = best ?? plans[0];
  const others = plans.filter((plan) => plan.slug !== hero?.slug);
  return (
    <section id="plans" className={styles.plans} aria-labelledby="c2-plans">
      <div className={styles.plansHead}>
        <h2 id="c2-plans" className={styles.h2}>
          {C2.plans.title}
        </h2>
        <p>{C2.plans.lead}</p>
      </div>
      {hero === undefined ? (
        <p>{C2.plans.empty}</p>
      ) : (
        <div className={styles.drop}>
          <Hero plan={hero} />
          {others.length === 0 ? null : (
            <div className={styles.lineup}>
              <h3 className={styles.lineupTitle}>{C2.plans.other}</h3>
              <ul>
                {others.map((plan) => (
                  <LineupItem key={plan.slug} plan={plan} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
