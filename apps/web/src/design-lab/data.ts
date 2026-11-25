import "server-only";
import {
  approximateMonthlyCost,
  bestValuePlan,
  totalMonths,
  type MembershipPlan,
} from "@masar/domain";
import { formatMonths, moneyParts, type MoneyParts } from "@/i18n/format";
import { localizedPath } from "@/i18n/locales";
import { getMembershipPlans } from "@/server/catalog";

const LOCALE = "ar";

/** باقة جاهزة للعرض: كل رقم محسوب من القاعدة على الخادم، والتصميم يعرض فقط. */
export interface LabPlan {
  readonly slug: string;
  readonly name: string;
  readonly summary: string;
  readonly href: string;
  readonly paidMonths: number;
  readonly bonusMonths: number;
  readonly totalMonths: number;
  /** «12 شهرًا» */
  readonly durationLabel: string;
  /** المدة كاملة مع الأشهر المجانية: «14 شهرًا» */
  readonly totalLabel: string;
  /** «شهران» أو فارغ إن لم توجد أشهر مجانية */
  readonly bonusLabel: string | undefined;
  readonly price: MoneyParts;
  /** تقريب للمقارنة، لا يظهر لباقة الشهر الواحد */
  readonly monthly: MoneyParts | undefined;
  readonly benefits: readonly string[];
  readonly isBestValue: boolean;
}

export interface LabData {
  readonly plans: readonly LabPlan[];
  readonly bestValue: LabPlan | undefined;
  /** أقل سعر إجمالي بين الباقات المعروضة («يبدأ من»). */
  readonly fromPrice: MoneyParts | undefined;
}

function toLabPlan(plan: MembershipPlan, best: MembershipPlan | undefined): LabPlan {
  const months = totalMonths(plan);
  return {
    slug: plan.slug,
    name: plan.name[LOCALE],
    summary: plan.summary[LOCALE],
    href: localizedPath(LOCALE, `/memberships/${plan.slug}`),
    paidMonths: plan.paidMonths,
    bonusMonths: plan.bonusMonths,
    totalMonths: months,
    durationLabel: formatMonths(plan.paidMonths, LOCALE),
    totalLabel: formatMonths(months, LOCALE),
    bonusLabel: plan.bonusMonths > 0 ? formatMonths(plan.bonusMonths, LOCALE) : undefined,
    price: moneyParts(plan.price, LOCALE),
    monthly: months > 1 ? moneyParts(approximateMonthlyCost(plan), LOCALE) : undefined,
    benefits: plan.benefits.map((benefit) => benefit[LOCALE]),
    isBestValue: best?.slug === plan.slug,
  };
}

/** الباقات المعروضة للبيع الآن من القاعدة، بالشكل الذي تحتاجه المفاهيم الثلاثة. */
export async function getLabData(): Promise<LabData> {
  const plans = await getMembershipPlans();
  const best = plans.length > 1 ? bestValuePlan(plans) : undefined;
  const labPlans = plans.map((plan) => toLabPlan(plan, best));
  const cheapest = plans.reduce<MembershipPlan | undefined>(
    (low, plan) =>
      low === undefined || plan.price.amountMinor < low.price.amountMinor ? plan : low,
    undefined,
  );
  return {
    plans: labPlans,
    bestValue: labPlans.find((plan) => plan.isBestValue),
    fromPrice: cheapest === undefined ? undefined : moneyParts(cheapest.price, LOCALE),
  };
}
