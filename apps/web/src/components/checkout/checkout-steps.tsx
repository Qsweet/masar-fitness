import { Icon } from "@/components/ui/icon";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/fill";
import { cx } from "@/lib/cx";
import styles from "./checkout-steps.module.css";

/** خطوات الاشتراك بترتيبها. */
const STEP_KEYS = ["plan", "details", "payment"] as const;
/** الخطوة الحالية: اختيار الباقة أو البيانات أو الدفع. */
export type CheckoutStep = (typeof STEP_KEYS)[number];

interface CheckoutStepsProps {
  readonly current: CheckoutStep;
  readonly labels: Dictionary["steps"];
}

/**
 * مؤشر خطوات الاشتراك: اختيار الباقة ← البيانات ← الدفع. السابقة مكتملة بعلامة، والحالية بالأصفر
 * (aria-current="step")، والخط بينها خط المضمار المتقطع.
 */
export function CheckoutSteps({ current, labels }: CheckoutStepsProps) {
  const currentIndex = STEP_KEYS.indexOf(current);
  return (
    <ol className={styles.steps} aria-label={labels.label}>
      {STEP_KEYS.map((key, index) => {
        const label = labels[key];
        const number = index + 1;
        const state = index < currentIndex ? "done" : index === currentIndex ? "current" : "next";
        return (
          <li
            key={label}
            className={cx(styles.step, styles[state])}
            aria-current={state === "current" ? "step" : undefined}
          >
            <span className={styles.dot} aria-hidden="true">
              {state === "done" ? <Icon name="check" /> : number}
            </span>
            <span>
              <span className="sr-only">
                {fill(labels.position, {
                  current: String(number),
                  total: String(STEP_KEYS.length),
                })}{" "}
              </span>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
