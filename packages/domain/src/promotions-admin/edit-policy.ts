import type {
  PromotionAudience,
  PromotionDiscount,
  PromotionScope,
  PromotionStatus,
} from "../commerce/pricing/promotion";
import { DomainError } from "../errors";
import { moneyEquals } from "../money";
import { err, ok, type Result } from "../result";
import type { PromotionDraft } from "./promotion-draft";

export interface PromotionEditPolicy {
  /** هل يُعدَّل العرض أصلًا؟ المؤرشف نهائي. */
  readonly editable: boolean;
  /**
   * هل تُعدَّل شروط الخصم (شكله وقيمته، ونوع النطاق، والجمهور، والبداية)؟ تُجمَّد بعد أول استخدام:
   * لقطات الطلبات السابقة صحيحة، لكن عرضًا واحدًا بخصمين يفسد أرقامه.
   */
  readonly terms: boolean;
}

/** ما يبقى قابلًا للتعديل بعد التجميد: الاسمان، النهاية، الحدّان، قائمة المنتجات، قابلية الجمع. */
export function promotionEditPolicy(facts: {
  readonly status: PromotionStatus;
  readonly hasRedemptions: boolean;
}): PromotionEditPolicy {
  if (facts.status === "archived") {
    return { editable: false, terms: false };
  }
  return { editable: true, terms: !facts.hasRedemptions };
}

export interface PromotionTerms {
  readonly code: string | null;
  readonly discount: PromotionDiscount;
  readonly scope: PromotionScope;
  readonly audience: PromotionAudience;
  readonly startsAt: Date;
}

function sameDiscount(a: PromotionDiscount, b: PromotionDiscount): boolean {
  if (a.kind === "percentage") {
    return b.kind === "percentage" && a.rate === b.rate;
  }
  return b.kind === "fixed_amount" && moneyEquals(a.amount, b.amount);
}

function sameFrozenTerms(current: PromotionTerms, draft: PromotionDraft): boolean {
  return (
    sameDiscount(current.discount, draft.discount) &&
    current.scope.kind === draft.scope.kind &&
    current.audience === draft.audience &&
    current.startsAt.getTime() === draft.startsAt.getTime()
  );
}

/**
 * هل يُقبل هذا التعديل؟ الرمز لا يتغير أبدًا (P2)، والمؤرشف لا يُعدَّل، وبعد أول استخدام لا تتغير الشروط
 * المجمَّدة. النموذج لا يرسم الحقول المجمَّدة، وهذا الفحص سدّ لمن يرسلها معدَّلة.
 */
export function checkPromotionEdit(
  current: PromotionTerms,
  draft: PromotionDraft,
  policy: PromotionEditPolicy,
): Result<true, DomainError> {
  if (!policy.editable) {
    return err(new DomainError("conflict", "promotion.archived_final"));
  }
  if (current.code !== draft.code) {
    return err(new DomainError("conflict", "promotion.code_immutable", { field: "code" }));
  }
  if (!policy.terms && !sameFrozenTerms(current, draft)) {
    return err(new DomainError("conflict", "promotion.terms_frozen"));
  }
  return ok(true);
}
