import { DomainError } from "../errors";
import { subtractMoney, type Money } from "../money";
import { approximateMonthlyCost, totalMonths, type MembershipPlan } from "./membership-plan";

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
 * الاشتراك المرجعي للمقارنة: الأقصر مدة كاملة (المدفوعة مع المجانية). عند التعادل الأول بترتيب
 * العرض، فالنتيجة ثابتة لا تعتمد على ترتيب داخلي.
 */
export function shortestPlan(plans: readonly MembershipPlan[]): MembershipPlan | undefined {
  return plans.reduce<MembershipPlan | undefined>(
    (shortest, plan) =>
      shortest === undefined || totalMonths(plan) < totalMonths(shortest) ? plan : shortest,
    undefined,
  );
}

/** ما يدفعه المشترك شهريًا في هذا الاشتراك مقابل ما يعادل الشهر في الأقصر مدة. */
export interface MonthlyComparison {
  readonly monthly: Money;
  readonly referenceMonthly: Money;
  readonly reference: MembershipPlan;
}

/**
 * مقارنة شهرية حقيقية لا نسبة مخترعة: تكلفة الشهر التقريبية (`approximateMonthlyCost`، التقريب
 * نفسه المعروض في كل مكان) لهذا الاشتراك وللأقصر مدة. تُعرض فقط حين تكون ذات معنى: اشتراك أطول من
 * المرجع، وشهره أرخص بعد التقريب (والعملة واحدة، يفرضها الطرح). وإلا undefined فلا يظهر سطر.
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
  const monthly = approximateMonthlyCost(plan);
  const referenceMonthly = approximateMonthlyCost(reference);
  // الطرح يتحقق من العملة الواحدة (خطأ ثابت إن اختلفت)
  if (subtractMoney(referenceMonthly, monthly).amountMinor <= 0) {
    return undefined;
  }
  return { monthly, referenceMonthly, reference };
}
