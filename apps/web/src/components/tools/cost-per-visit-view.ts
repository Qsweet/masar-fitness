import { costPerVisit, type MembershipPlan } from "@masar/domain";
import { toPlanViews } from "@/components/plans/plan-view";
import { moneyParts, type MoneyParts } from "@/i18n/format";
import type { Locale } from "@/i18n/locales";

/** هذا العرض لا يحمل زر شراء (رابطه لصفحة الاشتراكات)، فلا يعتمد على علم الشراء. */
const NO_PURCHASE_LINK = false;

/** صف جاهز للعرض: كل رقم محسوب على الخادم من الكتالوج الحي ودالة المجال. */
export interface CostRow {
  readonly slug: string;
  readonly name: string;
  readonly href: string;
  readonly durationText: string;
  readonly total: MoneyParts;
  readonly perVisit: MoneyParts;
  readonly isBestValue: boolean;
}

export function costRows(
  plans: readonly MembershipPlan[],
  visitsPerWeek: number,
  locale: Locale,
): CostRow[] {
  const views = toPlanViews(plans, locale, NO_PURCHASE_LINK);
  return plans.flatMap((plan, index) => {
    const view = views[index];
    return view === undefined
      ? []
      : [
          {
            slug: view.slug,
            name: view.name,
            href: view.href,
            durationText: view.durationText,
            total: view.price,
            perVisit: moneyParts(costPerVisit(plan, visitsPerWeek), locale),
            isBestValue: view.isBestValue,
          },
        ];
  });
}
