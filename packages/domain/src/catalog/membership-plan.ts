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

const FULL_SHARE = 100;

/** المدة التي يحصل عليها المشترك فعلًا: المدفوعة مع المجانية. */
export function totalMonths(plan: Pick<MembershipPlan, "paidMonths" | "bonusMonths">): number {
  return plan.paidMonths + plan.bonusMonths;
}

/**
 * تكلفة الشهر الواحد على كامل المدة (للمقارنة بين الباقات فقط، لا يُحصَّل بها).
 * تُقرَّب لأقرب هللة؛ الواجهة تعرضها «حوالي».
 */
export function monthlyEquivalent(plan: MembershipPlan): Money {
  const months = totalMonths(plan);
  if (!Number.isInteger(months) || months <= 0) {
    throw new DomainError("invariant", "plan.duration_not_positive");
  }
  return money(Math.round(plan.price.amountMinor / months), plan.price.currency);
}

/** أطول مدة بين الباقات المعروضة: مرجع رسم «المضمار». */
export function longestDuration(plans: readonly MembershipPlan[]): number {
  return plans.reduce((longest, plan) => Math.max(longest, totalMonths(plan)), 0);
}

/** نسبة مئوية صحيحة (0–100) لعدد أشهر من أطول مدة. */
export function durationShare(months: number, longest: number): number {
  if (longest <= 0 || months <= 0) {
    return 0;
  }
  return Math.min(FULL_SHARE, Math.round((months / longest) * FULL_SHARE));
}
