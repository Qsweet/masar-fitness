import type { Dictionary } from "@/i18n/dictionaries";
import type { PlanView } from "./plan-view";
import styles from "./duration-switch.module.css";

interface DurationSwitchProps {
  readonly plans: readonly PlanView[];
  /** المختار في الصفحة الأولى؛ بعدها الراديو نفسه يحمل الاختيار (غير متحكَّم به) */
  readonly initialSlug: string;
  readonly labels: Dictionary["plans"];
  /** قبل كل تغيير اختيار (لحفظ السعر المعروض قبله) */
  readonly onSelect: () => void;
}

/** المدد المكررة بين الاشتراكات المعروضة: مقاطعها تحتاج اسم الاشتراك لتتميز. */
function repeatedTerms(plans: readonly PlanView[]): ReadonlySet<string> {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const plan of plans) {
    (seen.has(plan.term) ? repeated : seen).add(plan.term);
  }
  return repeated;
}

/** العدد الأقصى للمقاطع بمؤشر منزلق؛ ما زاد عليه يلتف صفوفًا والمختار بخلفيته. */
const THUMB_MAX = 4;

/**
 * مبدّل المدة المقطّع: أزرار راديو حقيقية باسم واحد داخل `fieldset`، فالأسهم وTab وقارئ الشاشة تعمل
 * بنمط مجموعة الراديو الأصلي (والاتجاه من المتصفح في RTL)، وبلا JavaScript يبقى الاختيار يعمل ويبدّل
 * البطاقة بـCSS. المؤشر الأبيض ينزلق إلى المختار، و«الأكثر قيمة» شارة على مقطعه (محسوبة على الخادم).
 * اسم المقطع المنطوق المدة كاملة («3 أشهر + شهر مجانًا»)، والمدة المكررة يميّزها اسم الاشتراك.
 */
export function DurationSwitch({ plans, initialSlug, labels, onSelect }: DurationSwitchProps) {
  const repeated = repeatedTerms(plans);
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
              defaultChecked={plan.slug === initialSlug}
              onChange={onSelect}
              className={styles.input}
            />
            <span className={styles.term}>
              {plan.term}
              {plan.bonusText === undefined ? null : (
                <span className="sr-only"> {plan.bonusText}</span>
              )}
            </span>
            {repeated.has(plan.term) ? (
              <span className={styles.sub}>{plan.tier ?? plan.name}</span>
            ) : null}
            {plan.isBestValue ? <span className={styles.badge}>{labels.bestValue}</span> : null}
          </label>
        ))}
        <span className={styles.thumb} aria-hidden="true" />
      </div>
    </fieldset>
  );
}
