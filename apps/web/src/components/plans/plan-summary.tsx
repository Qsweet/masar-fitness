import { approximateMonthlyCost, totalMonths, type MembershipPlan } from "@masar/domain";
import { ButtonLink } from "@/components/ui/button-link";
import { Price } from "@/components/ui/price";
import type { Dictionary } from "@/i18n/dictionaries";
import { formatMonths, moneyParts } from "@/i18n/format";
import type { Locale } from "@/i18n/locales";
import { purchaseUrl } from "./plan-paths";

interface PlanSummaryProps {
  readonly plan: MembershipPlan;
  readonly locale: Locale;
  readonly dictionary: Dictionary;
}

/** «14 شهرًا: 12 شهرًا + شهران مجانًا» أو المدة وحدها إن لم توجد أشهر مجانية. بلا نعت يحتاج مطابقة العدد. */
function DurationLine({ plan, locale, dictionary }: PlanSummaryProps) {
  const total = formatMonths(totalMonths(plan), locale);
  if (plan.bonusMonths === 0) {
    return (
      <p>
        <span className="font-strong">{total}</span>
      </p>
    );
  }
  return (
    <p>
      <span className="font-strong">{total}</span>: {formatMonths(plan.paidMonths, locale)} +{" "}
      {formatMonths(plan.bonusMonths, locale)} {dictionary.plans.bonusSuffix}
    </p>
  );
}

/**
 * ملخص الشراء: الإجمالي الواجب دفعه واضح قبل أي ضغطة، ثم المدة، ثم زر واحد.
 * تكلفة الشهر تقريب للمقارنة فقط، ولا تظهر لباقة الشهر الواحد (تكرار للسعر نفسه).
 */
export function PlanSummary({ plan, locale, dictionary }: PlanSummaryProps) {
  return (
    <div className="surface-light surface-light-raised rule rounded-control border p-6 md:p-8">
      <p className="text-muted text-small font-medium">
        {plan.name[locale]}: {dictionary.plans.total}
      </p>
      <p className="mt-1 text-numeral font-strong">
        <Price parts={moneyParts(plan.price, locale)} unitClassName="text-heading font-medium" />
      </p>
      <p className="text-muted text-small">{dictionary.plans.vatIncluded}</p>
      <div className="rule mt-5 space-y-1 border-t pt-5">
        <DurationLine plan={plan} locale={locale} dictionary={dictionary} />
        {totalMonths(plan) > 1 ? (
          <p className="text-muted">
            {dictionary.plans.about}{" "}
            <Price parts={moneyParts(approximateMonthlyCost(plan), locale)} />{" "}
            {dictionary.plans.perMonth}
          </p>
        ) : null}
      </div>
      <ButtonLink href={purchaseUrl(plan, locale, dictionary)} external className="mt-6 w-full">
        {dictionary.plan.buyWhatsapp}
      </ButtonLink>
      <p className="text-muted mt-4 text-small">{dictionary.plan.buyNote}</p>
    </div>
  );
}

/** شريط شراء ثابت أسفل الجوال: السعر والزر دائمًا في متناول الإبهام. */
export function StickyPurchaseBar({ plan, locale, dictionary }: PlanSummaryProps) {
  return (
    <aside
      data-sticky-bar
      aria-label={dictionary.plan.stickyLabel}
      className="surface-deep fixed inset-x-0 bottom-0 z-10 pb-[env(safe-area-inset-bottom)] shadow-bar md:hidden"
    >
      <div className="page-container flex items-center justify-between gap-4 py-3">
        <p>
          <span className="text-muted block text-small">{plan.name[locale]}</span>
          <Price parts={moneyParts(plan.price, locale)} className="text-heading font-strong" />
        </p>
        <ButtonLink href={purchaseUrl(plan, locale, dictionary)} external className="min-h-12 px-5">
          {dictionary.plan.buyWhatsapp}
        </ButtonLink>
      </div>
    </aside>
  );
}
