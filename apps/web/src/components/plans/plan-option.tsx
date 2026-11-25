import { Icon } from "@/components/ui/icon";
import { Price } from "@/components/ui/price";
import type { Dictionary } from "@/i18n/dictionaries";
import { cx } from "@/lib/cx";
import type { PlanView } from "./plan-view";
import styles from "./plan-option.module.css";

interface OptionProps {
  readonly plan: PlanView;
  readonly selected: boolean;
  readonly labels: Dictionary["plans"];
  readonly onSelect: () => void;
}

/**
 * بطاقة سعر واحدة: زر راديو حقيقي شفاف فوق البطاقة كلها (الأسهم ولوحة المفاتيح وقارئ الشاشة تعمل).
 * الاسم والمدة الكاملة، ثم الإجمالي كبيرًا وما يعادله شهريًا، ثم ما يميز الاشتراك. الأوفر شهريًا (محسوب)
 * مرفوع بإطار متدرّج وشريط في أعلاه وسعر بالتدرّج، وفي أول القائمة على الهاتف والبقية صفوف مختصرة.
 */
export function PlanOption({ plan, selected, labels, onSelect }: OptionProps) {
  const features = [
    plan.freezeText,
    plan.benefitsShared ? labels.includesAll : undefined,
    labels.startsOnActivation,
  ].filter((feature) => feature !== undefined);
  return (
    <label
      className={cx(styles.option, plan.isBestValue && styles.best, selected && styles.selected)}
    >
      <input
        type="radio"
        name="plan"
        value={plan.slug}
        checked={selected}
        onChange={onSelect}
        className={styles.input}
      />
      {plan.isBestValue ? <span className={styles.ribbon}>{labels.bestValue}</span> : null}
      <span className={styles.head}>
        <span className={styles.name}>{plan.name}</span>
        <span className={styles.mark} aria-hidden="true" />
      </span>
      <span className={styles.duration}>{plan.durationText}</span>
      <span className={styles.figures}>
        <Price
          parts={plan.price}
          className={cx(styles.price, plan.isBestValue && "gradient-text")}
          unitClassName={styles.currency}
        />
        {plan.monthlyText === undefined ? null : (
          <span className={styles.perMonth}>{plan.monthlyText}</span>
        )}
      </span>
      <span className={styles.features}>
        {features.map((feature) => (
          <span key={feature}>
            <Icon name="check" className={styles.check} />
            {feature}
          </span>
        ))}
      </span>
      <span className={styles.choose} aria-hidden="true">
        {selected ? <Icon name="check" /> : null}
        {selected ? labels.selected : labels.choose}
      </span>
    </label>
  );
}
