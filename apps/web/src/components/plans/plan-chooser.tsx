import { durationShare, longestDuration, totalMonths, type MembershipPlan } from "@masar/domain";
import Link from "next/link";
import { Price } from "@/components/ui/price";
import type { Dictionary } from "@/i18n/dictionaries";
import { formatMonths, moneyParts } from "@/i18n/format";
import type { Locale } from "@/i18n/locales";
import { planHref } from "./plan-paths";
import { PlanTrack } from "./plan-track";

interface PlanChooserProps {
  readonly plans: readonly MembershipPlan[];
  readonly selected: MembershipPlan;
  /** الباقة الأقل تكلفة شهريًا (محسوبة)، تُعلَّم في القائمة. */
  readonly bestValue: MembershipPlan | undefined;
  readonly locale: Locale;
  readonly dictionary: Dictionary;
}

interface RowProps extends Omit<PlanChooserProps, "plans" | "bestValue"> {
  readonly plan: MembershipPlan;
  readonly longest: number;
  readonly isBestValue: boolean;
}

const ROW =
  "block rounded-control px-4 py-4 no-underline transition-colors duration-(--duration-press)";
const ROW_SELECTED = "surface-light-raised bg-(--surface) ring-2 ring-(--on-surface)";
const ROW_IDLE = "hover:bg-(--band)";

/** علامة الاختيار: دائرة ممتلئة للمختارة. المعنى يصل القارئ الآلي عبر aria-current. */
function SelectionMark({ selected }: { readonly selected: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`grid size-5 shrink-0 place-items-center rounded-full border-2 border-(--on-surface) ${selected ? "bg-(--on-surface)" : ""}`}
    >
      {selected ? <span className="size-2 rounded-full bg-(--surface)" /> : null}
    </span>
  );
}

function ChooserRow({ plan, selected, longest, isBestValue, locale, dictionary }: RowProps) {
  const isSelected = plan.slug === selected.slug;
  return (
    <li>
      <Link
        href={planHref(plan, locale)}
        aria-current={isSelected ? "true" : undefined}
        className={`${ROW} ${isSelected ? ROW_SELECTED : ROW_IDLE}`}
      >
        <span className="flex items-center gap-3">
          <SelectionMark selected={isSelected} />
          <span className="flex-1">
            <span className="block text-heading font-strong">
              {formatMonths(plan.paidMonths, locale)}
            </span>
            {plan.bonusMonths > 0 ? (
              <span className="block text-small font-medium">
                + {formatMonths(plan.bonusMonths, locale)} {dictionary.plans.bonusSuffix}
              </span>
            ) : null}
            {isBestValue ? (
              <span className="text-muted block text-small">{dictionary.plans.bestValue}</span>
            ) : null}
          </span>
          <Price
            parts={moneyParts(plan.price, locale)}
            className="text-heading font-strong"
            unitClassName="text-small"
          />
        </span>
        <span className="mt-2 block">
          <PlanTrack
            paidShare={durationShare(plan.paidMonths, longest)}
            totalShare={durationShare(totalMonths(plan), longest)}
          />
        </span>
      </Link>
    </li>
  );
}

/**
 * اختيار المدة: كل باقة صف، وخطها يُظهر مدتها مقارنة بالبقية. الصف رابط لصفحة الباقة،
 * فالاختيار يعمل بلا JavaScript ولكل باقة رابط يُشارَك ويُفهرَس.
 */
export function PlanChooser({ plans, selected, bestValue, locale, dictionary }: PlanChooserProps) {
  const longest = longestDuration(plans);
  return (
    <ul aria-label={dictionary.plans.listLabel} className="space-y-1 md:space-y-2">
      {plans.map((plan) => (
        <ChooserRow
          key={plan.slug}
          plan={plan}
          selected={selected}
          longest={longest}
          isBestValue={plan.slug === bestValue?.slug && plans.length > 1}
          locale={locale}
          dictionary={dictionary}
        />
      ))}
    </ul>
  );
}
