import type { LabPlan } from "../data";
import { cx } from "../cx";
import { fill } from "../text";
import { C1 } from "./copy";
import styles from "./c1.module.css";

function Plate({ plan }: { readonly plan: LabPlan }) {
  const [count, ...unitWords] = plan.durationLabel.split(" ");
  const isWordOnly = unitWords.length === 0;
  return (
    <li className={cx(styles.plate, plan.isBestValue && styles.plateBest)}>
      {plan.isBestValue ? <p className={styles.plateFlag}>{C1.plans.bestValue}</p> : null}
      <p className={styles.plateDuration}>
        <span className={isWordOnly ? styles.plateWord : styles.plateNumber}>{count}</span>
        {isWordOnly ? null : <span className={styles.plateUnit}>{unitWords.join(" ")}</span>}
      </p>
      <h3 className={styles.plateName}>{plan.name}</h3>
      {plan.bonusLabel === undefined ? (
        <p className={styles.plateBonusEmpty} aria-hidden="true" />
      ) : (
        <p className={styles.plateBonus}>{fill(C1.plans.bonus, { bonus: plan.bonusLabel })}</p>
      )}
      <p className={styles.platePrice}>
        <bdi>{plan.price.amount}</bdi> <span>{plan.price.unit}</span>
      </p>
      <p className={styles.plateMonthly}>
        {plan.monthly === undefined
          ? " "
          : fill(C1.plans.monthly, { amount: plan.monthly.amount, unit: plan.monthly.unit })}
      </p>
      <a href={plan.href} className={styles.plateCta}>
        {C1.plans.choose}
        <span className={styles.srOnly}>: {plan.name}</span>
      </a>
    </li>
  );
}

/**
 * «المجموعة»: كل باقة لوح قائم كأعمدة معمارية بخطوط فاصلة لا بطاقات.
 * المدة رقم ضخم رفيع هو بطل اللوح، والسعر الإجمالي تحته بلا لبس.
 */
export function Plans({ plans }: { readonly plans: readonly LabPlan[] }) {
  return (
    <section id="plans" aria-labelledby="c1-plans" className={styles.plans}>
      <div className={styles.sectionHead}>
        <h2 id="c1-plans" className={styles.h2}>
          {C1.plans.title}
        </h2>
        <p className={styles.lead}>{C1.plans.lead}</p>
      </div>
      {plans.length === 0 ? (
        <p className={styles.lead}>{C1.plans.empty}</p>
      ) : (
        <ul className={styles.plates}>
          {plans.map((plan) => (
            <Plate key={plan.slug} plan={plan} />
          ))}
        </ul>
      )}
    </section>
  );
}
