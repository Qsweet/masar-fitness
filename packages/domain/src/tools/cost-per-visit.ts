import { totalMonths, type MembershipPlan } from "../catalog/membership-plan";
import { DomainError } from "../errors";
import { money, type Money } from "../money";

/** حدود عدد الزيارات في الأسبوع التي تقبلها الأداة: زيارة واحدة إلى زيارة كل يوم. */
export const MIN_VISITS_PER_WEEK = 1;
export const MAX_VISITS_PER_WEEK = 7;
/** القيمة حين لا يختار الزائر أو يرسل قيمة غير صالحة. اختيار عرض، لا قاعدة عمل. */
export const DEFAULT_VISITS_PER_WEEK = 3;

/** السنة 52 أسبوعًا و12 شهرًا، فالشهر 52/12 أسبوعًا (≈ 4.33). تقريب معلن في الواجهة. */
const WEEKS_PER_YEAR = 52;
const MONTHS_PER_YEAR = 12;

/** عدد زيارات صحيح بين الحدين، وإلا فهو خطأ برمجي عند المستدعي (الواجهة تتحقق أولًا). */
function assertVisitsPerWeek(visitsPerWeek: number): void {
  const inRange = visitsPerWeek >= MIN_VISITS_PER_WEEK && visitsPerWeek <= MAX_VISITS_PER_WEEK;
  if (!Number.isInteger(visitsPerWeek) || !inRange) {
    throw new DomainError("invariant", "cost_per_visit.visits_out_of_range");
  }
}

/**
 * تقسيم صحيح بتقريب نصف الوحدة إلى الأعلى، للقيم غير السالبة فقط:
 * round(n / d) = floor((2n + d) / 2d). كله أعداد صحيحة، فلا خطأ كسور عشرية.
 */
function divideRounded(numerator: number, denominator: number): number {
  const doubled = numerator * 2 + denominator;
  if (!Number.isSafeInteger(doubled) || !Number.isSafeInteger(denominator * 2)) {
    throw new DomainError("invariant", "cost_per_visit.overflow");
  }
  return Math.floor(doubled / (denominator * 2));
}

/**
 * تكلفة الزيارة الواحدة التقريبية لاشتراك، بالهللة.
 *
 * عدد الزيارات خلال المدة = الأشهر × (52 ÷ 12) × زيارات الأسبوع، فتكون:
 *   تكلفة الزيارة = السعر ÷ الزيارات = (السعر × 12) ÷ (الأشهر × 52 × زيارات الأسبوع).
 * البسط والمقام عددان صحيحان، والقسمة تُقرَّب **مرة واحدة** في النهاية لأقرب هللة؛
 * لا نحسب «أسابيع الشهر» عددًا عشريًا ثم نقسم عليه (تقريبان متتاليان يتراكم خطؤهما).
 * المدة هي كامل ما يحصل عليه المشترك (المدفوعة مع المجانية). للعرض «تقريبًا» فقط، ولا يُحصَّل بها.
 */
export function costPerVisit(plan: MembershipPlan, visitsPerWeek: number): Money {
  assertVisitsPerWeek(visitsPerWeek);
  const months = totalMonths(plan);
  if (!Number.isInteger(months) || months <= 0) {
    throw new DomainError("invariant", "plan.duration_not_positive");
  }
  if (plan.price.amountMinor < 0) {
    throw new DomainError("invariant", "cost_per_visit.negative_price");
  }
  const numerator = plan.price.amountMinor * MONTHS_PER_YEAR;
  const denominator = months * WEEKS_PER_YEAR * visitsPerWeek;
  return money(divideRounded(numerator, denominator), plan.price.currency);
}

const SINGLE_DIGIT = /^[0-9]$/u;

/**
 * يقرأ عدد الزيارات من معامل الرابط (‎?visits=3‎) بصرامة: رقم واحد بين الحدين فقط.
 * أي شيء آخر (غائب، مكرر، نص، كسر، صفر، مسافات) يرجع القيمة الافتراضية بلا خطأ.
 */
export function parseVisitsPerWeek(raw: string | readonly string[] | undefined): number {
  if (typeof raw !== "string" || !SINGLE_DIGIT.test(raw)) {
    return DEFAULT_VISITS_PER_WEEK;
  }
  const value = Number(raw);
  return value >= MIN_VISITS_PER_WEEK && value <= MAX_VISITS_PER_WEEK
    ? value
    : DEFAULT_VISITS_PER_WEEK;
}
