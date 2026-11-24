import { durationShare, monthlyEquivalent, totalMonths, type MembershipPlan } from "@masar/domain";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button-link";
import { Price } from "@/components/ui/price";
import type { Dictionary } from "@/i18n/dictionaries";
import { moneyParts, roundedMoneyParts } from "@/i18n/format";
import { localizedPath, type Locale } from "@/i18n/locales";
import { PlanDuration } from "./plan-duration";
import { PlanTrack } from "./plan-track";

interface PlanLaneProps {
  readonly plan: MembershipPlan;
  /** أطول مدة بين الباقات المعروضة: مرجع طول المضمار. */
  readonly longest: number;
  readonly locale: Locale;
  readonly dictionary: Dictionary;
}

export function planPath(plan: MembershipPlan): string {
  return `/memberships/${plan.slug}`;
}

/** حارة واحدة في المضمار = باقة واحدة: المدة، الاسم، السعر الإجمالي، ثم خطها. */
export function PlanLane({ plan, longest, locale, dictionary }: PlanLaneProps) {
  const href = localizedPath(locale, planPath(plan));
  return (
    <li className="rule border-t py-8 md:py-10">
      <div className="grid grid-cols-2 items-end gap-x-6 gap-y-4 md:grid-cols-12">
        <div className="md:col-span-3">
          <PlanDuration
            paidMonths={plan.paidMonths}
            bonusMonths={plan.bonusMonths}
            locale={locale}
            dictionary={dictionary}
          />
        </div>
        <div className="text-end md:order-3 md:col-span-3">
          <p className="text-title font-display">
            <Price
              parts={moneyParts(plan.price, locale)}
              unitClassName="text-heading font-strong"
            />
          </p>
          <p className="text-muted text-small">
            {dictionary.plans.about}{" "}
            <Price parts={roundedMoneyParts(monthlyEquivalent(plan), locale)} />{" "}
            {dictionary.plans.perMonth}
          </p>
        </div>
        <div className="col-span-2 md:order-2 md:col-span-3 lg:col-span-4">
          <h3 className="text-heading font-strong">
            <Link href={href} className="underline-offset-4 hover:underline">
              {plan.name[locale]}
            </Link>
          </h3>
          <p className="text-muted">{plan.summary[locale]}</p>
        </div>
        <div className="col-span-2 md:order-4 md:col-span-3 md:justify-self-end lg:col-span-2">
          <ButtonLink href={href} className="w-full md:w-auto">
            {dictionary.plans.choose}
            <span className="sr-only">: {plan.name[locale]}</span>
          </ButtonLink>
        </div>
      </div>
      <div className="mt-6">
        <PlanTrack
          paidShare={durationShare(plan.paidMonths, longest)}
          totalShare={durationShare(totalMonths(plan), longest)}
        />
      </div>
    </li>
  );
}
