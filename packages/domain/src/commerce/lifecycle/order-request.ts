import type { Buyer } from "./buyer";

export type RequestLocale = "ar" | "en";

export interface OrderRequest {
  readonly planSlug: string;
  readonly addonSlugs: readonly string[];
  readonly couponCode: string | null;
  readonly buyer: Buyer;
  readonly locale: RequestLocale;
}

export interface AssessmentRequestInput {
  readonly productSlug: string;
  readonly buyer: Buyer;
  readonly locale: RequestLocale;
}

/** ترتيب ثابت بوحدات الترميز لا بلغة المتصفح، لتبقى البصمة واحدة في كل بيئة. */
function byCodeUnit(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

/**
 * الصيغة المعيارية لطلب الشراء قبل التجزئة (sha256 في طبقة القاعدة).
 * المفاتيح بترتيب أبجدي ثابت، والإضافات مرتبة بلا تكرار، فلا يغيّر ترتيبها البصمة.
 */
export function canonicalOrderRequest(request: OrderRequest): string {
  const addonSlugs = [...new Set(request.addonSlugs)].sort(byCodeUnit);
  return JSON.stringify({
    addonSlugs,
    buyer: { mobile: request.buyer.mobile, name: request.buyer.name },
    couponCode: request.couponCode,
    locale: request.locale,
    planSlug: request.planSlug,
  });
}

/** الصيغة المعيارية لطلب التقييم، بالقاعدة نفسها. */
export function canonicalAssessmentRequest(request: AssessmentRequestInput): string {
  return JSON.stringify({
    buyer: { mobile: request.buyer.mobile, name: request.buyer.name },
    locale: request.locale,
    productSlug: request.productSlug,
  });
}

/** المفتاح نفسه ببصمة مطابقة ⇒ إعادة النتيجة نفسها، وببصمة مختلفة ⇒ تعارض. */
export function replayDecision(stored: string, incoming: string): "replay" | "conflict" {
  return stored === incoming ? "replay" : "conflict";
}
