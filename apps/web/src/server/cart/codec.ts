import "server-only";
import { isSlug } from "../checkout/form-schema";

/**
 * السلة: اشتراك واحد على الأكثر (محرك الطلب يبيع اشتراكًا واحدًا مع إضافاته، والإضافات تُختار
 * في خطوة البيانات). لا سعر هنا: كل عرض يقرأ السعر من القاعدة.
 */
export interface Cart {
  readonly slug: string | null;
}

export const EMPTY_CART: Cart = { slug: null };

/** بادئة صيغة الكوكي؛ صيغة غير معروفة تُقرأ سلة فارغة. */
const FORMAT_PREFIX = "v1.";

export function encodeCart(cart: Cart): string {
  return cart.slug === null ? "" : `${FORMAT_PREFIX}${cart.slug}`;
}

/** كوكي غائب أو تالف أو بصيغة غير معروفة ⇒ سلة فارغة، بلا خطأ. */
export function decodeCart(raw: string | undefined): Cart {
  if (raw?.startsWith(FORMAT_PREFIX) !== true) {
    return EMPTY_CART;
  }
  const slug = raw.slice(FORMAT_PREFIX.length);
  return isSlug(slug) ? { slug } : EMPTY_CART;
}

/** عدد السطور في السلة لشارة الترويسة. */
export function cartCount(cart: Cart): number {
  return cart.slug === null ? 0 : 1;
}
