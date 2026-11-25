import { DomainError } from "../../errors";
import { err, ok, type Result } from "../../result";

/** المنتج كما قرأته طبقة القاعدة بالـslug، أو undefined إن لم يوجد. */
export interface AssessmentProductFact {
  readonly product: { readonly kind: string; readonly status: string } | undefined;
}

/**
 * الخدمة بتقييم تنشئ طلب تقييم (ليدًا) لا طلب شراء. لا يُقبل إلا منتج `assessed_service` فعّال،
 * وما عداه غير موجود في نظر العميل.
 */
export function validateAssessmentRequest(facts: AssessmentProductFact): Result<true, DomainError> {
  const { product } = facts;
  if (product?.kind !== "assessed_service" || product.status !== "active") {
    return err(new DomainError("not_found", "assessment.product_unavailable"));
  }
  return ok(true);
}
