import { Price } from "@/components/ui/price";
import { cx } from "@/lib/cx";
import type { PlanView } from "./plan-view";
import styles from "./plan-option.module.css";

interface OptionProps {
  readonly plan: PlanView;
  readonly selected: boolean;
  readonly bestValueLabel: string;
  readonly onSelect: () => void;
}

/**
 * مربع مدة واحد: زر راديو حقيقي شفاف فوق المربع كله. ما يُرى: رقم كبير ووحدته والمكافأة، ثم الإجمالي
 * وما يعادله شهريًا تحت فاصل، فيُرى لماذا السنوي هو الأوفر دون فتح الملخص. الرقم والوحدة للعين فقط،
 * وقارئ الشاشة يسمع المدة بصيغتها الصحيحة («شهر واحد» لا «1 شهر»).
 */
export function PlanOption({ plan, selected, bestValueLabel, onSelect }: OptionProps) {
  const { count, unit } = plan.duration;
  return (
    <label className={cx(styles.option, selected && styles.selected)}>
      <input
        type="radio"
        name="plan"
        value={plan.slug}
        checked={selected}
        onChange={onSelect}
        className={styles.input}
      />
      <span className={styles.mark} aria-hidden="true" />
      {plan.isBestValue ? <span className={styles.flag}>{bestValueLabel}</span> : null}
      <span className={styles.duration} aria-hidden="true">
        <span className={styles.count}>{count}</span>
        <span className={styles.unit}>{unit}</span>
      </span>
      <span className="sr-only">{plan.term}</span>
      <span className={styles.bonus}>{plan.bonusText}</span>
      <span className={styles.figures}>
        <Price parts={plan.price} className={styles.optionPrice} unitClassName={styles.currency} />
        <span className={styles.perMonth}>{plan.monthlyText}</span>
      </span>
    </label>
  );
}
