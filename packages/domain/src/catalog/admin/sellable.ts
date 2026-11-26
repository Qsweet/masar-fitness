/** أنواع المنتجات وحالاتها كما في القاعدة (`product_kind` و`product_status`). */
export const PRODUCT_KINDS = [
  "membership",
  "digital_program",
  "assessed_service",
  "addon",
] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];

export const PRODUCT_STATUSES = ["draft", "active", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export interface SellableFacts {
  readonly status: ProductStatus;
  readonly kind: ProductKind;
  /** النسخة السارية الآن، أو null إن لم توجد. */
  readonly currentVersion: { readonly durationMonths: number | null } | null;
}

/**
 * هل يُباع المنتج الآن؟ فعّال، وله نسخة سارية، ونوعه يُشترى مباشرة (الخدمة بتقييم تبدأ بحجز لا بدفع)،
 * والاشتراك له مدة. القاعدة الواحدة التي تطبقها السلة (`loadCartLines`) وقائمة الموقع ولوحة التحكم.
 */
export function isSellable(facts: SellableFacts): boolean {
  if (facts.status !== "active" || facts.currentVersion === null) {
    return false;
  }
  if (facts.kind === "assessed_service") {
    return false;
  }
  return facts.kind !== "membership" || facts.currentVersion.durationMonths !== null;
}
