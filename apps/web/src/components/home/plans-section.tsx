import type { MembershipPlan } from "@masar/domain";
import Link from "next/link";
import { PlanLanes } from "@/components/plans/plan-lanes";
import type { Dictionary } from "@/i18n/dictionaries";
import { localizedPath, type Locale } from "@/i18n/locales";

interface PlansSectionProps {
  readonly plans: readonly MembershipPlan[];
  readonly locale: Locale;
  readonly dictionary: Dictionary;
}

export function PlansSection({ plans, locale, dictionary }: PlansSectionProps) {
  return (
    <section
      id="plans"
      aria-labelledby="plans-title"
      className="surface-asphalt scroll-mt-4 pb-20 md:pb-28"
    >
      <div className="page-container">
        <div className="grid gap-4 pb-10 md:grid-cols-12 md:items-end">
          <h2 id="plans-title" className="text-title font-display md:col-span-5">
            {dictionary.plans.title}
          </h2>
          <p className="text-muted max-w-prose md:col-span-6 md:col-start-7">
            {dictionary.plans.lead}
          </p>
        </div>
        <PlanLanes plans={plans} locale={locale} dictionary={dictionary} />
        {plans.length > 1 ? (
          <p className="mt-8">
            <Link
              href={`${localizedPath(locale, "/memberships")}#compare`}
              className="font-strong underline underline-offset-4"
            >
              {dictionary.plans.compare}
            </Link>
          </p>
        ) : null}
      </div>
    </section>
  );
}
