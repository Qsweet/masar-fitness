import { longestDuration, type MembershipPlan } from "@masar/domain";
import { ButtonLink } from "@/components/ui/button-link";
import { whatsappUrl } from "@/config/club";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/locales";
import { PlanLane } from "./plan-lane";

interface PlanLanesProps {
  readonly plans: readonly MembershipPlan[];
  readonly locale: Locale;
  readonly dictionary: Dictionary;
}

/** لا باقات معروضة: نوجّه الزائر لقناة تعمل بدل قائمة فارغة. */
function EmptyPlans({ dictionary }: Pick<PlanLanesProps, "dictionary">) {
  return (
    <div className="rule border-y py-10">
      <p className="text-heading font-strong">{dictionary.plans.emptyTitle}</p>
      <p className="text-muted mt-2">{dictionary.plans.emptyLead}</p>
      <ButtonLink href={whatsappUrl(dictionary.location.whatsappMessage)} external className="mt-6">
        {dictionary.plans.emptyAction}
      </ButtonLink>
    </div>
  );
}

/** المضمار: كل باقة حارة، وطول خطها مدتها مقارنة بأطول باقة. */
export function PlanLanes({ plans, locale, dictionary }: PlanLanesProps) {
  if (plans.length === 0) {
    return <EmptyPlans dictionary={dictionary} />;
  }
  const longest = longestDuration(plans);
  return (
    <ol aria-label={dictionary.plans.listLabel} className="rule border-b">
      {plans.map((plan) => (
        <PlanLane
          key={plan.slug}
          plan={plan}
          longest={longest}
          locale={locale}
          dictionary={dictionary}
        />
      ))}
    </ol>
  );
}
