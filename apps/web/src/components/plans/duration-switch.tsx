import type { Dictionary } from "@/i18n/dictionaries";
import type { PlanView } from "./plan-view";
import styles from "./duration-switch.module.css";

interface DurationSwitchProps {
  readonly plans: readonly PlanView[];
  readonly selectedSlug: string;
  readonly labels: Dictionary["plans"];
  readonly onSelect: (slug: string) => void;
}

/** العدد الأقصى للمقاطع بمؤشر منزلق؛ ما زاد عليه يلتف صفوفًا والمختار بخلفيته. */
const THUMB_MAX = 4;

/**
 * مبدّل المدة المقطّع: أزرار راديو حقيقية باسم واحد داخل `fieldset`، فالأسهم وTab وقارئ الشاشة تعمل
 * بنمط مجموعة الراديو الأصلي (والاتجاه من المتصفح في RTL)، وبلا JavaScript يبقى الاختيار يعمل ويبدّل
 * البطاقة بـCSS. المؤشر الأبيض ينزلق إلى المختار، و«الأكثر قيمة» شارة على مقطعه (محسوبة على الخادم).
 */
export function DurationSwitch({ plans, selectedSlug, labels, onSelect }: DurationSwitchProps) {
  return (
    <fieldset className={styles.switch}>
      <legend className="sr-only">{labels.legend}</legend>
      <div
        className={styles.track}
        data-count={plans.length}
        data-thumb={plans.length <= THUMB_MAX ? "" : undefined}
      >
        {plans.map((plan) => (
          <label
            key={plan.slug}
            className={styles.segment}
            data-segment
            data-best={plan.isBestValue ? "" : undefined}
          >
            <input
              type="radio"
              name="plan"
              value={plan.slug}
              checked={plan.slug === selectedSlug}
              onChange={() => {
                onSelect(plan.slug);
              }}
              className={styles.input}
            />
            <span className={styles.term}>{plan.term}</span>
            {plan.isBestValue ? <span className={styles.badge}>{labels.bestValue}</span> : null}
          </label>
        ))}
        <span className={styles.thumb} aria-hidden="true" />
      </div>
    </fieldset>
  );
}
