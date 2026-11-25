import { DomainError } from "../errors";
import { money, type Money } from "../money";

export interface LocalizedText {
  readonly ar: string;
  readonly en: string;
}

/** باقة اشتراك كما تُعرض للبيع الآن: هوية المنتج مع نسخة تسعيره السارية. */
export interface MembershipPlan {
  readonly slug: string;
  readonly name: LocalizedText;
  readonly summary: LocalizedText;
  /** السعر الإجمالي شامل الضريبة */
  readonly price: Money;
  readonly paidMonths: number;
  /** أشهر مجانية فوق المدة المدفوعة */
  readonly bonusMonths: number;
  readonly benefits: readonly LocalizedText[];
}

/** المدة التي يحصل عليها المشترك فعلًا: المدفوعة مع المجانية. */
export function totalMonths(plan: Pick<MembershipPlan, "paidMonths" | "bonusMonths">): number {
  return plan.paidMonths + plan.bonusMonths;
}

/** عدد الهللات في الريال. */
export const MINOR_PER_MAJOR = 100;

function assertPositiveDuration(months: number): void {
  if (!Number.isInteger(months) || months <= 0) {
    throw new DomainError("invariant", "plan.duration_not_positive");
  }
}

/**
 * تكلفة الشهر التقريبية على كامل المدة، مقرَّبة لأقرب ريال **مرة واحدة** من السعر والمدة.
 * للمقارنة والعرض «ما يعادل …» فقط، ولا يُحصَّل بها.
 */
export function approximateMonthlyCost(plan: MembershipPlan): Money {
  const months = totalMonths(plan);
  assertPositiveDuration(months);
  const wholeRiyals = Math.round(plan.price.amountMinor / (months * MINOR_PER_MAJOR));
  return money(wholeRiyals * MINOR_PER_MAJOR, plan.price.currency);
}

/**
 * هل الباقة الأولى أقل تكلفة شهريًا من الثانية؟ مقارنة صحيحة بالضرب التبادلي (بلا قسمة ولا تقريب):
 * سعر‌أ ÷ مدة‌أ < سعر‌ب ÷ مدة‌ب ⇔ سعر‌أ × مدة‌ب < سعر‌ب × مدة‌أ. عند التعادل تُقدَّم الأطول مدة.
 */
function isBetterValue(candidate: MembershipPlan, current: MembershipPlan): boolean {
  const candidateMonths = totalMonths(candidate);
  const currentMonths = totalMonths(current);
  assertPositiveDuration(candidateMonths);
  assertPositiveDuration(currentMonths);
  const difference =
    candidate.price.amountMinor * currentMonths - current.price.amountMinor * candidateMonths;
  return difference < 0 || (difference === 0 && candidateMonths > currentMonths);
}

/**
 * الباقة الأقل تكلفة شهريًا على كامل مدتها: حقيقة محسوبة لا رأي تسويقي.
 * تُعرض مختارة افتراضيًا وتُعلَّم «الأقل تكلفة شهريًا».
 */
export function bestValuePlan(plans: readonly MembershipPlan[]): MembershipPlan | undefined {
  return plans.reduce<MembershipPlan | undefined>(
    (best, plan) => (best === undefined || isBetterValue(plan, best) ? plan : best),
    undefined,
  );
}

function benefitKey(benefit: LocalizedText): string {
  return JSON.stringify([benefit.ar, benefit.en]);
}

/**
 * المزايا المشتركة حين تشمل كل الباقات المعروضة المزايا نفسها تمامًا (بأي ترتيب)، وإلا undefined.
 * الواجهة تختصر بها («يشمل جميع مرافق النادي») بدل تكرار القائمة نفسها في كل باقة؛ حقيقة محسوبة
 * من الكتالوج لا افتراض، فإن اختلفت باقة واحدة عادت القوائم المفصّلة.
 */
export function sharedBenefits(
  plans: readonly Pick<MembershipPlan, "benefits">[],
): readonly LocalizedText[] | undefined {
  const [first, ...rest] = plans;
  if (first === undefined || first.benefits.length === 0) {
    return undefined;
  }
  const keys = new Set(first.benefits.map(benefitKey));
  const same = rest.every(
    (plan) =>
      plan.benefits.length === keys.size &&
      new Set(plan.benefits.map(benefitKey)).size === keys.size &&
      plan.benefits.every((benefit) => keys.has(benefitKey(benefit))),
  );
  return same && keys.size === first.benefits.length ? first.benefits : undefined;
}
