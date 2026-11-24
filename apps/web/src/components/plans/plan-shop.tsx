import { bestValuePlan, type MembershipPlan } from "@masar/domain";
import { ButtonLink } from "@/components/ui/button-link";
import { whatsappUrl } from "@/config/club";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/locales";
import { PlanChooser } from "./plan-chooser";
import { PlanSummary, StickyPurchaseBar } from "./plan-summary";

interface PlanShopProps {
  readonly plans: readonly MembershipPlan[];
  /** الباقة المعروضة في الملخص. إن غابت تُختار الأقل تكلفة شهريًا. */
  readonly selected?: MembershipPlan;
  readonly locale: Locale;
  readonly dictionary: Dictionary;
}

/** لا باقات معروضة: نوجّه الزائر لقناة تعمل بدل قائمة فارغة. */
function EmptyPlans({ dictionary }: Pick<PlanShopProps, "dictionary">) {
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

/**
 * قلب الموقع: اختيار المدة بجانب ملخص الشراء. على الجوال القائمة ثم الملخص، مع شريط شراء ثابت.
 * يُستعمل في الرئيسية وصفحة الباقات وصفحة الباقة بالشكل نفسه.
 */
export function PlanShop({ plans, selected, locale, dictionary }: PlanShopProps) {
  const bestValue = bestValuePlan(plans);
  const current = selected ?? bestValue;
  if (current === undefined) {
    return <EmptyPlans dictionary={dictionary} />;
  }
  return (
    <div className="grid gap-6 md:grid-cols-12 md:items-start md:gap-10">
      <div className="md:col-span-7">
        <PlanChooser
          plans={plans}
          selected={current}
          bestValue={bestValue}
          locale={locale}
          dictionary={dictionary}
        />
        <p className="text-muted mt-4 text-small">{dictionary.plans.lead}</p>
      </div>
      <div className="md:sticky md:top-8 md:col-span-5">
        <PlanSummary plan={current} locale={locale} dictionary={dictionary} />
      </div>
      <StickyPurchaseBar plan={current} locale={locale} dictionary={dictionary} />
    </div>
  );
}
