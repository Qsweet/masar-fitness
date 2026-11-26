import type { LocalizedText } from "../membership-plan";
import type { ProductTerms } from "./product-draft";

/**
 * ما يُكتب لتعديل شروط منتج (ADMIN_A2_SALES §4.2):
 * - `none`: لا فرق.
 * - `benefits_only`: المزايا وحدها تغيّرت؛ تُعدَّل في مكانها إن لم تُبع النسخة، وإلا نسخة جديدة.
 * - `new_version`: السعر أو المدة أو الأشهر المجانية تغيّر، أو لا نسخة سارية: نسخة جديدة دائمًا.
 */
export type VersionChange = "none" | "benefits_only" | "new_version";

function sameBenefits(a: readonly LocalizedText[], b: readonly LocalizedText[]): boolean {
  return (
    a.length === b.length &&
    a.every((benefit, index) => {
      const other = b[index];
      return benefit.ar === other?.ar && benefit.en === other.en;
    })
  );
}

export function planVersionChange(current: ProductTerms | null, next: ProductTerms): VersionChange {
  if (current === null) {
    return "new_version";
  }
  const sameTerms =
    current.priceMinor === next.priceMinor &&
    current.durationMonths === next.durationMonths &&
    current.bonusMonths === next.bonusMonths;
  if (!sameTerms) {
    return "new_version";
  }
  return sameBenefits(current.benefits, next.benefits) ? "none" : "benefits_only";
}
