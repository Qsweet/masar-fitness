import type { Dictionary } from "@/i18n/dictionaries";
import { formatMonths, monthsParts } from "@/i18n/format";
import type { Locale } from "@/i18n/locales";

interface PlanDurationProps {
  readonly paidMonths: number;
  readonly bonusMonths: number;
  readonly locale: Locale;
  readonly dictionary: Dictionary;
}

/** المدة كعنصر طباعي: الرقم كبير ووحدته بجانبه، والأشهر المجانية تحته. */
export function PlanDuration({ paidMonths, bonusMonths, locale, dictionary }: PlanDurationProps) {
  const { count, unit } = monthsParts(paidMonths, locale);
  return (
    <p>
      <span className="flex items-baseline gap-2">
        {count === undefined ? null : <span className="text-numeral font-display">{count}</span>}
        <span
          className={count === undefined ? "text-numeral font-display" : "text-heading font-strong"}
        >
          {unit}
        </span>
      </span>
      {bonusMonths > 0 ? (
        <span className="mt-1 block text-small font-medium text-lane-500">
          + {formatMonths(bonusMonths, locale)} {dictionary.plans.bonusSuffix}
        </span>
      ) : null}
    </p>
  );
}
