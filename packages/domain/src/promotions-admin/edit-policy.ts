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

/**
 * لماذا لا يُعدَّل العرض: المؤرشف نهائي، والجمهور المقيَّد محجوب بقرار مالك (تعريف «العميل الجديد»)
 * فعرض قائم به يُقرأ ولا يُعدَّل، وإلا صار «للجميع» بحفظ النموذج.
 */
export type PromotionEditLock = "archived" | "restricted_audience";

const LOCK_REASONS: Readonly<Record<PromotionEditLock, string>> = {
  archived: "promotion.archived_final",
  restricted_audience: "promotion.audience_restricted",
};

/** دقة حقل البداية في النموذج: الدقيقة. بداية بثوانٍ (من خارج اللوحة) تساوي دقيقتها. */
const START_PRECISION_MS = 60_000;

export interface PromotionEditPolicy {
  /** هل يُعدَّل العرض أصلًا؟ */
  readonly editable: boolean;
  /** سبب المنع حين لا يُعدَّل، وإلا null. */
  readonly lock: PromotionEditLock | null;
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
  readonly audience: PromotionAudience;
}): PromotionEditPolicy {
  if (facts.status === "archived") {
    return { editable: false, lock: "archived", terms: false };
  }
  if (facts.audience !== "anyone") {
    return { editable: false, lock: "restricted_audience", terms: false };
  }
  return { editable: true, lock: null, terms: !facts.hasRedemptions };
}

/** البدايتان في الدقيقة نفسها: النموذج يكتب البداية بالدقيقة. */
function sameStartMinute(a: Date, b: Date): boolean {
  return (
    Math.floor(a.getTime() / START_PRECISION_MS) === Math.floor(b.getTime() / START_PRECISION_MS)
  );
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
    sameStartMinute(current.startsAt, draft.startsAt)
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
    return err(new DomainError("conflict", LOCK_REASONS[policy.lock ?? "archived"]));
  }
  if (current.code !== draft.code) {
    return err(new DomainError("conflict", "promotion.code_immutable", { field: "code" }));
  }
  if (!policy.terms && !sameFrozenTerms(current, draft)) {
    return err(new DomainError("conflict", "promotion.terms_frozen"));
  }
  return ok(true);
}
