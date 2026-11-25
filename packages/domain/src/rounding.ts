import { DomainError } from "./errors";

/**
 * تقسيم صحيح بتقريب نصف الوحدة إلى الأعلى، للقيم غير السالبة فقط:
 * round(n / d) = floor((2n + d) / 2d). كله أعداد صحيحة، فلا خطأ كسور عشرية.
 */
export function divideRounded(numerator: number, denominator: number): number {
  const doubled = numerator * 2 + denominator;
  if (!Number.isSafeInteger(doubled) || !Number.isSafeInteger(denominator * 2)) {
    throw new DomainError("invariant", "rounding.overflow");
  }
  return Math.floor(doubled / (denominator * 2));
}
