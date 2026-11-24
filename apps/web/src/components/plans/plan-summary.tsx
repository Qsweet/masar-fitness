import { durationShare, totalMonths, type MembershipPlan } from "@masar/domain";
import Link from "next/link";
import type { Dictionary } from "@/i18n/dictionaries";
import { formatMonths } from "@/i18n/format";
import { localizedPath, type Locale } from "@/i18n/locales";
import { PlanDuration } from "./plan-duration";
import { PlanTrack } from "./plan-track";

interface PlanSummaryProps {
  readonly plan: MembershipPlan;
  readonly locale: Locale;
  readonly dictionary: Dictionary;
}

/** رأس صفحة الباقة: الاسم والمدة ومضمارها كاملًا (المدفوع ثم المجاني). */
export function PlanSummary({ plan, locale, dictionary }: PlanSummaryProps) {
  const total = totalMonths(plan);
  return (
    <section className="surface-asphalt pt-10 pb-16 md:pt-14 md:pb-24">
      <div className="page-container">
        <p>
          <Link
            href={localizedPath(locale, "/memberships")}
            className="font-medium underline underline-offset-4"
          >
            {dictionary.plan.back}
          </Link>
        </p>
        <h1 className="mt-8 text-display font-display">{plan.name[locale]}</h1>
        <p className="text-muted mt-4 max-w-prose text-lead">{plan.summary[locale]}</p>
        <div className="mt-12">
          <h2 className="text-subtle text-small font-medium">{dictionary.plan.durationTitle}</h2>
          <div className="mt-2">
            <PlanDuration
              paidMonths={plan.paidMonths}
              bonusMonths={plan.bonusMonths}
              locale={locale}
              dictionary={dictionary}
            />
          </div>
          <div className="mt-6">
            <PlanTrack
              paidShare={durationShare(plan.paidMonths, total)}
              totalShare={durationShare(total, total)}
            />
          </div>
          {plan.bonusMonths > 0 ? (
            <p className="text-muted mt-4 text-small">
              {formatMonths(plan.paidMonths, locale)} {dictionary.plan.paid} +{" "}
              {formatMonths(plan.bonusMonths, locale)} {dictionary.plan.bonus} ={" "}
              {formatMonths(total, locale)}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
