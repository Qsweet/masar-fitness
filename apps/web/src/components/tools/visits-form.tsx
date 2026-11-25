"use client";

import { MAX_VISITS_PER_WEEK, MIN_VISITS_PER_WEEK } from "@masar/domain";
import { useRouter } from "next/navigation";
import type { ChangeEvent } from "react";
import { buttonClass } from "@/components/ui/button-link";
import { cx } from "@/lib/cx";
import styles from "./cost-per-visit.module.css";

interface VisitsFormProps {
  readonly visits: number;
  /** مسار الحاسبة بلغة الزائر: وجهة النموذج ورابط النتيجة (‎?visits=3‎). */
  readonly action: string;
  readonly legend: string;
  readonly submit: string;
}

const FIELD = "visits";

const VISIT_OPTIONS = Array.from(
  { length: MAX_VISITS_PER_WEEK - MIN_VISITS_PER_WEEK + 1 },
  (_, index) => MIN_VISITS_PER_WEEK + index,
);

/**
 * نموذج GET حقيقي: يعمل بلا JavaScript بزر «احسب»، والنتيجة برابط قابل للمشاركة (‎?visits=3‎).
 * مع JavaScript يكفي اختيار الرقم: يُستبدل الرابط وتُحدَّث النتيجة في مكانها بلا إعادة تحميل ولا
 * انتقال للتركيز (لا تغيير سياق، WCAG 3.2.2)، والزر يختفي بـCSS ‏(scripting: enabled) لأنه صار زائدًا.
 */
export function VisitsForm({ visits, action, legend, submit }: VisitsFormProps) {
  const router = useRouter();
  const recalculate = (event: ChangeEvent<HTMLFormElement>) => {
    const value = new FormData(event.currentTarget).get(FIELD);
    if (typeof value === "string") {
      router.replace(`${action}?${new URLSearchParams({ [FIELD]: value }).toString()}`, {
        scroll: false,
      });
    }
  };
  return (
    <form method="get" action={action} className={styles.form} onChange={recalculate}>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{legend}</legend>
        <div className={styles.options}>
          {VISIT_OPTIONS.map((option) => (
            <label key={option} className={styles.option}>
              <input type="radio" name={FIELD} value={option} defaultChecked={option === visits} />
              <span>{option}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <button type="submit" className={cx(buttonClass("ink"), styles.submit)}>
        {submit}
      </button>
    </form>
  );
}
