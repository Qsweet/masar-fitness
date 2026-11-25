import {
  approximateMonthlyCost,
  bestValuePlan,
  totalMonths,
  type MembershipPlan,
} from "@masar/domain";
import { whatsappUrl } from "@/config/club";
import { getDictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/fill";
import {
  formatMonths,
  moneyParts,
  monthsParts,
  type MoneyParts,
  type MonthsParts,
} from "@/i18n/format";
import { localizedPath, type Locale } from "@/i18n/locales";

/**
 * اشتراك جاهز للعرض: كل رقم ونص محسوب هنا على الخادم من القاعدة والقاموس،
 * والمكوّن التفاعلي يعرض فقط. لا سعر يُحسب في المتصفح.
 */
export interface PlanView {
  readonly slug: string;
  readonly name: string;
  /** صفحة الاشتراك */
  readonly href: string;
  /** مسار الشراء الحالي: واتساب النادي برسالة تسمّي الاشتراك (القرار 18) */
  readonly purchaseHref: string;
  /** المدة المدفوعة مقسومة رقمًا ووحدة: «12» + «شهرًا»، أو «شهر» وحدها */
  readonly duration: MonthsParts;
  /** «+ شهران مجانًا» أو غائب */
  readonly bonusText: string | undefined;
  /** «14 شهرًا: 12 شهرًا + شهران مجانًا» أو «3 أشهر» */
  readonly durationText: string;
  readonly price: MoneyParts;
  /** تقريب للمقارنة، لا يظهر لاشتراك الشهر الواحد (تكرار للسعر نفسه) */
  readonly monthlyText: string | undefined;
  readonly benefits: readonly string[];
  readonly isBestValue: boolean;
}

function durationText(plan: MembershipPlan, locale: Locale): string {
  const total = formatMonths(totalMonths(plan), locale);
  if (plan.bonusMonths === 0) {
    return total;
  }
  return fill(getDictionary(locale).plans.durationBonus, {
    total,
    paid: formatMonths(plan.paidMonths, locale),
    bonus: formatMonths(plan.bonusMonths, locale),
  });
}

function monthlyText(plan: MembershipPlan, locale: Locale): string | undefined {
  if (totalMonths(plan) <= 1) {
    return undefined;
  }
  const { amount, unit } = moneyParts(approximateMonthlyCost(plan), locale);
  return fill(getDictionary(locale).plans.monthly, { amount, unit });
}

function toPlanView(plan: MembershipPlan, locale: Locale, bestSlug: string | undefined): PlanView {
  const dictionary = getDictionary(locale);
  const name = plan.name[locale];
  return {
    slug: plan.slug,
    name,
    href: localizedPath(locale, `/memberships/${plan.slug}`),
    purchaseHref: whatsappUrl(fill(dictionary.plan.whatsappMessage, { plan: name })),
    duration: monthsParts(plan.paidMonths, locale),
    bonusText:
      plan.bonusMonths > 0
        ? fill(dictionary.plans.bonus, { bonus: formatMonths(plan.bonusMonths, locale) })
        : undefined,
    durationText: durationText(plan, locale),
    price: moneyParts(plan.price, locale),
    monthlyText: monthlyText(plan, locale),
    benefits: plan.benefits.map((benefit) => benefit[locale]),
    isBestValue: plan.slug === bestSlug,
  };
}

/** الاشتراكات المعروضة بترتيبها، و«الأوفر شهريًا» معلَّم فقط حين توجد مقارنة (أكثر من اشتراك). */
export function toPlanViews(plans: readonly MembershipPlan[], locale: Locale): PlanView[] {
  const bestSlug = plans.length > 1 ? bestValuePlan(plans)?.slug : undefined;
  return plans.map((plan) => toPlanView(plan, locale, bestSlug));
}

/** الاختيار الأول في المحدِّد: الاشتراك المطلوب إن وُجد، ثم الأوفر شهريًا، ثم الأول. */
export function initialPlanSlug(
  views: readonly PlanView[],
  requested?: string,
): string | undefined {
  const match = views.find((view) => view.slug === requested);
  return (match ?? views.find((view) => view.isBestValue) ?? views[0])?.slug;
}
