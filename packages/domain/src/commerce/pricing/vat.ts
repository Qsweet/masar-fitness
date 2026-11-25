import { DomainError } from "../../errors";
import { money, type Money } from "../../money";
import { BASIS_POINTS_SCALE } from "./limits";
import { mulDivHalfUp } from "./rounding";

declare const basisPointsBrand: unique symbol;

/** نسبة بنقاط الأساس (1500 = 15%): عدد صحيح بين 0 و10000. تُبنى عبر `basisPoints()` فقط. */
export type BasisPoints = number & { readonly [basisPointsBrand]: true };

export function basisPoints(value: number): BasisPoints {
  if (!Number.isInteger(value) || value < 0 || value > BASIS_POINTS_SCALE) {
    throw new DomainError("invariant", "basis_points.out_of_range");
  }
  return (value + 0) as BasisPoints;
}

/**
 * الضريبة المتضمَّنة في مبلغ شامل لها: `gross·r / (10000 + r)` بالنصف يُرفع.
 * أسعار الكتالوج شاملة الضريبة، فالضريبة تُستخرج منها ولا تُضاف عليها.
 */
export function vatIncludedIn(gross: Money, rate: BasisPoints): Money {
  return money(mulDivHalfUp(gross.amountMinor, rate, BASIS_POINTS_SCALE + rate), gross.currency);
}
