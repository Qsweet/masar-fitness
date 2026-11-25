import {
  approximateMonthlyCost,
  bestValuePlan,
  sharedBenefits,
  totalMonths,
  type MembershipPlan,
} from "@masar/domain";
import { whatsappUrl } from "@/config/club";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/fill";
import {
  countedMonthsParts,
  formatMonths,
  moneyParts,
  type MoneyParts,
  type MonthsParts,
} from "@/i18n/format";
import { localizedPath, type Locale } from "@/i18n/locales";

/** وجهة زر الشراء: داخلية (صفحة بيانات الشراء) أو خارجية (واتساب). */
export interface PurchaseLink {
  readonly href: string;
  readonly external: boolean;
}

/**
 * اشتراك جاهز للعرض: كل رقم ونص محسوب هنا على الخادم من القاعدة والقاموس،
 * والمكوّن التفاعلي يعرض فقط. لا سعر يُحسب في المتصفح.
 */
export interface PlanView {
  readonly slug: string;
  readonly name: string;
  /** صفحة الاشتراك */
  readonly href: string;
  /** زر الشراء: صفحة البيانات والشراء الإلكتروني مفتوح، وإلا واتساب (القرار 18) */
  readonly purchase: PurchaseLink;
  /** واتساب النادي برسالة تسمّي الاشتراك: الزر نفسه والشراء مغلق، ورابط ثانوي وهو مفتوح */
  readonly whatsappHref: string;
  /** المدة المدفوعة رقمًا ووحدة لمربع الاختيار، للعين فقط: «12» + «شهرًا»، «1» + «شهر» */
  readonly duration: Required<MonthsParts>;
  /** المدة المدفوعة كما يسمعها قارئ الشاشة بدل الرقم والوحدة: «12 شهرًا»، «شهر واحد» */
  readonly term: string;
  /** «+ شهران مجانًا» أو غائب */
  readonly bonusText: string | undefined;
  /** «14 شهرًا، منها شهران مجانًا» أو «3 أشهر» */
  readonly durationText: string;
  readonly price: MoneyParts;
  /** «نحو 200 ر.س شهريًا» في مربع المدة وفي الملخص؛ غائب لاشتراك الشهر الواحد (تكرار للسعر نفسه) */
  readonly monthlyText: string | undefined;
  readonly benefits: readonly string[];
  /** كل الاشتراكات المعروضة بالمزايا نفسها: يكفي الملخصَ سطر واحد بدل القائمة المكررة */
  readonly benefitsShared: boolean;
  readonly isBestValue: boolean;
}

/** «14 شهرًا، منها شهران مجانًا» أو «3 أشهر»؛ يستعمله ملخص الشراء ومراجعة الطلب أيضًا. */
export function durationText(
  plan: Pick<MembershipPlan, "paidMonths" | "bonusMonths">,
  locale: Locale,
): string {
  const total = formatMonths(totalMonths(plan), locale);
  if (plan.bonusMonths === 0) {
    return total;
  }
  return fill(getDictionary(locale).plans.durationBonus, {
    total,
    bonus: formatMonths(plan.bonusMonths, locale),
  });
}

/** المدة المدفوعة منطوقة: الشهر الواحد بالعدد مكتوبًا («شهر واحد») لا «1 شهر». */
function termText(paidMonths: number, locale: Locale): string {
  return paidMonths === 1 ? getDictionary(locale).plans.oneMonth : formatMonths(paidMonths, locale);
}

/** التكلفة الشهرية التقريبية، للمدد الأطول من شهر فقط (للشهر الواحد هي السعر نفسه). */
function monthlyText(plan: MembershipPlan, locale: Locale): string | undefined {
  if (totalMonths(plan) <= 1) {
    return undefined;
  }
  const { amount, unit } = moneyParts(approximateMonthlyCost(plan), locale);
  return fill(getDictionary(locale).plans.monthly, { amount, unit });
}

function planWhatsappUrl(plan: MembershipPlan, locale: Locale, dictionary: Dictionary): string {
  return whatsappUrl(fill(dictionary.plan.whatsappMessage, { plan: plan.name[locale] }));
}

/** وجهة زر الشراء. والعلم مغلق تبقى واتساب كما اليوم بلا أي تغيير. */
export function purchaseHref(
  plan: MembershipPlan,
  locale: Locale,
  dictionary: Dictionary,
  checkoutEnabled: boolean,
): PurchaseLink {
  if (checkoutEnabled) {
    return { href: localizedPath(locale, `/checkout/${plan.slug}`), external: false };
  }
  return { href: planWhatsappUrl(plan, locale, dictionary), external: true };
}

interface ViewContext {
  readonly locale: Locale;
  readonly bestSlug: string | undefined;
  readonly checkoutEnabled: boolean;
  readonly benefitsShared: boolean;
}

function toPlanView(plan: MembershipPlan, context: ViewContext): PlanView {
  const { locale, bestSlug, checkoutEnabled, benefitsShared } = context;
  const dictionary = getDictionary(locale);
  return {
    slug: plan.slug,
    name: plan.name[locale],
    href: localizedPath(locale, `/memberships/${plan.slug}`),
    purchase: purchaseHref(plan, locale, dictionary, checkoutEnabled),
    whatsappHref: planWhatsappUrl(plan, locale, dictionary),
    duration: countedMonthsParts(plan.paidMonths, locale),
    term: termText(plan.paidMonths, locale),
    bonusText:
      plan.bonusMonths > 0
        ? fill(dictionary.plans.bonus, { bonus: formatMonths(plan.bonusMonths, locale) })
        : undefined,
    durationText: durationText(plan, locale),
    price: moneyParts(plan.price, locale),
    monthlyText: monthlyText(plan, locale),
    benefits: plan.benefits.map((benefit) => benefit[locale]),
    benefitsShared,
    isBestValue: plan.slug === bestSlug,
  };
}

/**
 * الاشتراكات المعروضة بترتيبها، و«الأوفر شهريًا» معلَّم فقط حين توجد مقارنة (أكثر من اشتراك)،
 * وكذلك اختصار المزايا المشتركة: يُحسب من الكتالوج (sharedBenefits) لا يُفترض.
 * `checkoutEnabled` من علم الخادم (isCheckoutEnabled) تمرّره الصفحة، فلا يُقرأ العلم في المتصفح.
 */
export function toPlanViews(
  plans: readonly MembershipPlan[],
  locale: Locale,
  checkoutEnabled: boolean,
): PlanView[] {
  const bestSlug = plans.length > 1 ? bestValuePlan(plans)?.slug : undefined;
  const benefitsShared = plans.length > 1 && sharedBenefits(plans) !== undefined;
  return plans.map((plan) =>
    toPlanView(plan, { locale, bestSlug, checkoutEnabled, benefitsShared }),
  );
}

/** الاختيار الأول في المحدِّد: الاشتراك المطلوب إن وُجد، ثم الأوفر شهريًا، ثم الأول. */
export function initialPlanSlug(
  views: readonly PlanView[],
  requested?: string,
): string | undefined {
  const match = views.find((view) => view.slug === requested);
  return (match ?? views.find((view) => view.isBestValue) ?? views[0])?.slug;
}
