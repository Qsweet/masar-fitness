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

/** مربع مدة واحد: زر راديو حقيقي شفاف فوق المربع كله، وما يُرى رقم ووحدة ومكافأة وسعر. */
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
      <span className={styles.duration}>
        <span className={styles.count}>{count}</span>
        <span className={styles.unit}>{unit}</span>
      </span>
      <span className={styles.bonus}>{plan.bonusText}</span>
      <Price parts={plan.price} className={styles.optionPrice} unitClassName={styles.optionUnit} />
    </label>
  );
}
