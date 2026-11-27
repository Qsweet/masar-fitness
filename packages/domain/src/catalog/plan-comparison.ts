import { DomainError } from "../errors";
import { subtractMoney, type Money } from "../money";
import {
  approximateMonthlyCost,
  sharedBenefits,
  totalMonths,
  type MembershipPlan,
} from "./membership-plan";

/**
 * شريط الأشهر في محدِّد المدة: عدد الأشهر المدفوعة والمجانية كما في الكتالوج. أكثر من هذا الحد
 * لا يُرسم شريطًا (تصير الحبات أدق من أن تُقرأ على الهاتف)، والمدة مكتوبة نصًا في كل حال.
 */
export const MAX_STRIP_MONTHS = 24;

export interface MonthStrip {
  readonly paid: number;
  readonly free: number;
}

/**
 * أشهر الشريط: المدفوعة ثم المجانية. لا شريط لاشتراك شهر واحد (حبة واحدة لا تقارن شيئًا) ولا لما
 * يتجاوز الحد. المدد غير الصحيحة خطأ ثابت كبقية حسابات الباقة.
 */
export function monthStrip(
  plan: Pick<MembershipPlan, "paidMonths" | "bonusMonths">,
): MonthStrip | undefined {
  const { paidMonths, bonusMonths } = plan;
  if (!Number.isInteger(paidMonths) || paidMonths <= 0) {
    throw new DomainError("invariant", "plan.duration_not_positive");
  }
  if (!Number.isInteger(bonusMonths) || bonusMonths < 0) {
    throw new DomainError("invariant", "plan.duration_not_positive");
  }
  const months = totalMonths(plan);
  if (months <= 1 || months > MAX_STRIP_MONTHS) {
    return undefined;
  }
  return { paid: paidMonths, free: bonusMonths };
}

/**
 * ترتيب المرجع: الأقصر مدة كاملة، ثم الأرخص شهريًا بمقارنة صحيحة بالضرب التبادلي (بلا قسمة ولا
 * تقريب). سالب ⇐ الأول قبل الثاني.
 */
function referenceOrder(a: MembershipPlan, b: MembershipPlan): number {
  const months = totalMonths(a) - totalMonths(b);
  if (months !== 0) {
    return months;
  }
  return a.price.amountMinor * totalMonths(b) - b.price.amountMinor * totalMonths(a);
}

/**
 * الاشتراك المرجعي للمقارنة: الأقصر مدة كاملة (المدفوعة مع المجانية)، ومن بين المتساوية مدةً الأرخص
 * شهريًا، فلا يُقارَن بأغلى اشتراك قصير ليبدو التوفير أكبر. عند التعادل التام الأول بترتيب العرض.
 */
export function shortestPlan(plans: readonly MembershipPlan[]): MembershipPlan | undefined {
  return plans.reduce<MembershipPlan | undefined>(
    (best, plan) => (best === undefined || referenceOrder(plan, best) < 0 ? plan : best),
    undefined,
  );
}

/** ما يدفعه المشترك شهريًا في هذا الاشتراك مقابل ما يعادل الشهر في الأقصر مدة. */
export interface MonthlyComparison {
  readonly monthly: Money;
  readonly referenceMonthly: Money;
  readonly reference: MembershipPlan;
}

/** أقل فرق شهري حقيقي (قبل التقريب) يستحق سطر مقارنة: ريال واحد بالهللة. */
const MIN_MONTHLY_DIFFERENCE_MINOR = 100;

/**
 * هل يقل شهر هذا الاشتراك عن شهر المرجع بريال على الأقل قبل أي تقريب؟ بالأعداد الصحيحة:
 * سعرم ÷ مدةم − سعر ÷ مدة ≥ 100 ⇔ سعرم × مدة − سعر × مدةم ≥ 100 × مدةم × مدة.
 */
function cheaperByOneRiyal(plan: MembershipPlan, reference: MembershipPlan): boolean {
  const months = totalMonths(plan);
  const referenceMonths = totalMonths(reference);
  const difference =
    reference.price.amountMinor * months - plan.price.amountMinor * referenceMonths;
  return difference >= MIN_MONTHLY_DIFFERENCE_MINOR * months * referenceMonths;
}

/**
 * مقارنة شهرية حقيقية لا نسبة مخترعة: تكلفة الشهر التقريبية (`approximateMonthlyCost`، التقريب
 * نفسه المعروض في كل مكان) لهذا الاشتراك وللمرجع (`shortestPlan`). تُعرض فقط حين تكون ذات معنى
 * وصادقة: اشتراك أطول من المرجع، **بالمزايا نفسها** (وإلا فالفرق ليس في المدة وحدها)، وشهره أرخص
 * بريال على الأقل قبل التقريب، والعملة واحدة (يفرضها الطرح). وإلا undefined فلا يظهر سطر.
 */
export function monthlyComparison(
  plan: MembershipPlan,
  plans: readonly MembershipPlan[],
): MonthlyComparison | undefined {
  const reference = shortestPlan(plans);
  if (reference === undefined || reference.slug === plan.slug) {
    return undefined;
  }
  if (totalMonths(plan) <= totalMonths(reference)) {
    return undefined;
  }
  if (sharedBenefits([plan, reference]) === undefined) {
    return undefined;
  }
  const monthly = approximateMonthlyCost(plan);
  const referenceMonthly = approximateMonthlyCost(reference);
  // الطرح يتحقق من العملة الواحدة (خطأ ثابت إن اختلفت)
  if (subtractMoney(referenceMonthly, monthly).amountMinor <= 0) {
    return undefined;
  }
  return cheaperByOneRiyal(plan, reference) ? { monthly, referenceMonthly, reference } : undefined;
}
