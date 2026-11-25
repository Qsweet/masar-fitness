import {
  approximateMonthlyCost,
  bestValuePlan,
  sharedBenefits,
  totalMonths,
  type MembershipPlan,
} from "@masar/domain";
import { whatsappUrl } from "@/config/club";
import { CLUB_FACTS } from "@/config/club-facts";
import { countText } from "@/i18n/count";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/fill";
import { formatMonths, moneyParts, type MoneyParts } from "@/i18n/format";
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
  /** المدة المدفوعة مكتوبة: «12 شهرًا»، «شهر واحد» */
  readonly term: string;
  /** «+ شهران مجانًا» أو غائب */
  readonly bonusText: string | undefined;
  /** «14 شهرًا، منها شهران مجانًا» أو «3 أشهر» */
  readonly durationText: string;
  readonly price: MoneyParts;
  /** «نحو 200 ر.س شهريًا» في مربع المدة وفي الملخص؛ غائب لاشتراك الشهر الواحد (تكرار للسعر نفسه) */
  readonly monthlyText: string | undefined;
  /** «تجميد حتى 60 يومًا»: 5 أيام لكل شهر مدفوع كما في شروط النادي الحالية (config/club-facts.ts) */
  readonly freezeText: string;
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

/** أيام التجميد المتاحة: لكل شهر مدفوع عدد ثابت، والأشهر المجانية لا تُحتسب (شروط النادي الحالية). */
export function freezeDays(paidMonths: number): number {
  return paidMonths * CLUB_FACTS.freezeDaysPerPaidMonth;
}

function freezeText(paidMonths: number, dictionary: Dictionary): string {
  return fill(dictionary.plans.freeze, {
    days: countText(freezeDays(paidMonths), dictionary.days),
  });
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
    term: termText(plan.paidMonths, locale),
    bonusText:
      plan.bonusMonths > 0
        ? fill(dictionary.plans.bonus, { bonus: formatMonths(plan.bonusMonths, locale) })
        : undefined,
    durationText: durationText(plan, locale),
    price: moneyParts(plan.price, locale),
    monthlyText: monthlyText(plan, locale),
    freezeText: freezeText(plan.paidMonths, dictionary),
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

/** الاختيار الأول في المحدِّد: الأوفر شهريًا، ثم الأول. */
export function initialPlanSlug(views: readonly PlanView[]): string | undefined {
  return (views.find((view) => view.isBestValue) ?? views[0])?.slug;
}

/**
 * ترتيب بطاقات الأسعار في الصف: الأوفر شهريًا في الوسط كما في لغة القالب، وبقية الاشتراكات بترتيبها.
 * ترتيب الشيفرة هو الترتيب المرئي على الشاشة الواسعة، فيتطابق معه التنقل بلوحة المفاتيح وقارئ الشاشة.
 */
export function centreBestValue<T extends { readonly isBestValue: boolean }>(
  views: readonly T[],
): T[] {
  const best = views.find((view) => view.isBestValue);
  if (best === undefined) {
    return [...views];
  }
  const rest = views.filter((view) => view !== best);
  const middle = Math.floor(rest.length / 2);
  return [...rest.slice(0, middle), best, ...rest.slice(middle)];
}
