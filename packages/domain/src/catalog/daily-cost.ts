import { DomainError } from "../errors";
import { money, type Money } from "../money";
import { divideRounded } from "../rounding";
import { totalMonths, type MembershipPlan } from "./membership-plan";

/** السنة 365 يومًا و12 شهرًا، فالشهر 365/12 يومًا (≈ 30.4). تقريب معلن في الواجهة («≈»). */
const DAYS_PER_YEAR = 365;
const MONTHS_PER_YEAR = 12;

/**
 * تكلفة اليوم التقريبية على كامل مدة الاشتراك (المدفوعة مع المجانية)، بالهللة.
 *
 * عدد الأيام = الأشهر × 365 ÷ 12، فتكون: تكلفة اليوم = (السعر × 12) ÷ (الأشهر × 365).
 * البسط والمقام عددان صحيحان، والقسمة تُقرَّب **مرة واحدة** لأقرب هللة (النصف للأعلى).
 * للعرض «≈ … يوميًا» فقط، ولا يُحصَّل بها.
 */
export function approximateDailyCost(plan: MembershipPlan): Money {
  const months = totalMonths(plan);
  if (!Number.isInteger(months) || months <= 0) {
    throw new DomainError("invariant", "plan.duration_not_positive");
  }
  if (plan.price.amountMinor < 0) {
    throw new DomainError("invariant", "plan.negative_price");
  }
  const numerator = plan.price.amountMinor * MONTHS_PER_YEAR;
  return money(divideRounded(numerator, months * DAYS_PER_YEAR), plan.price.currency);
}
