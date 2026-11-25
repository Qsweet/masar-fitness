import { DomainError } from "../../errors";

/**
 * قاعدتا التقريب والتوزيع الوحيدتان في التسعير. كل حساب وسيط بـBigInt
 * فلا يفيض الضرب ولا تدخله فاصلة عائمة، ثم يُعاد الناتج عددًا صحيحًا آمنًا.
 */

const HALF_UP_FACTOR = 2n;
const BIG_ZERO = 0n;
const BIG_ONE = 1n;

function assertNonNegativeInteger(value: number, reason: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new DomainError("invariant", reason);
  }
}

function toSafeNumber(value: bigint, reason: string): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new DomainError("invariant", reason);
  }
  return Number(value);
}

/**
 * `floor((2·a·n + d) / (2·d))`: ناتج `a·n/d` مقرَّبًا بالنصف يُرفع.
 * المدخلات أعداد صحيحة غير سالبة، والمقام موجب.
 */
export function mulDivHalfUp(amount: number, numerator: number, denominator: number): number {
  assertNonNegativeInteger(amount, "rounding.amount_not_non_negative_integer");
  assertNonNegativeInteger(numerator, "rounding.numerator_not_non_negative_integer");
  if (!Number.isSafeInteger(denominator) || denominator <= 0) {
    throw new DomainError("invariant", "rounding.denominator_not_positive_integer");
  }
  const a = BigInt(amount);
  const n = BigInt(numerator);
  const d = BigInt(denominator);
  // قسمة BigInt تقصّ نحو الصفر، وهي هنا floor لأن الطرفين موجبان
  const result = (HALF_UP_FACTOR * a * n + d) / (HALF_UP_FACTOR * d);
  return toSafeNumber(result, "rounding.result_not_safe");
}

interface Portion {
  readonly index: number;
  readonly share: bigint;
  readonly remainder: bigint;
}

/** الباقي الأكبر أولًا، وعند التعادل الموضع الأصغر. */
function byLargestRemainder(a: Portion, b: Portion): number {
  if (a.remainder !== b.remainder) {
    return a.remainder > b.remainder ? -1 : 1;
  }
  return a.index - b.index;
}

/**
 * يوزّع `total` على أوزان بطريقة الباقي الأكبر: الحصة `floor(total·w_i/W)`، ثم الهللات الباقية
 * واحدة لكل موضع بترتيب الباقي الأكبر ثم الموضع الأصغر.
 * يضمن `Σ = total` دائمًا، و`حصة_i ≤ w_i` متى كان `total ≤ W`.
 */
export function allocateByLargestRemainder(
  total: number,
  weights: readonly number[],
): readonly number[] {
  assertNonNegativeInteger(total, "allocation.total_not_non_negative_integer");
  for (const weight of weights) {
    assertNonNegativeInteger(weight, "allocation.weight_not_non_negative_integer");
  }
  const weightSum = weights.reduce((sum, weight) => sum + BigInt(weight), BIG_ZERO);
  if (weightSum === BIG_ZERO) {
    if (total > 0) {
      throw new DomainError("invariant", "allocation.zero_weights");
    }
    return weights.map(() => 0);
  }
  const bigTotal = BigInt(total);
  const portions: Portion[] = weights.map((weight, index) => {
    const scaled = bigTotal * BigInt(weight);
    return { index, share: scaled / weightSum, remainder: scaled % weightSum };
  });
  const allocated = portions.reduce((sum, portion) => sum + portion.share, BIG_ZERO);
  const leftover = Number(bigTotal - allocated);
  const shares = portions.map((portion) => portion.share);
  for (const portion of [...portions].sort(byLargestRemainder).slice(0, leftover)) {
    shares[portion.index] = portion.share + BIG_ONE;
  }
  return shares.map((share) => toSafeNumber(share, "allocation.share_not_safe"));
}
