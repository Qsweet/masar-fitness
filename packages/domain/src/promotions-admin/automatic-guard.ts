import {
  isInScope,
  type PromotionDiscount,
  type PromotionScope,
} from "../commerce/pricing/promotion";
import { BASIS_POINTS_SCALE } from "../commerce/pricing/limits";
import type { LocalizedText } from "../catalog/membership-plan";
import type { Money } from "../money";

/** منتج يُباع الآن بسعره الساري: ما يقارن به حارس العرض التلقائي. */
export interface SellablePrice {
  readonly id: string;
  readonly name: LocalizedText;
  readonly price: Money;
}

export interface AutomaticTerms {
  /** فارغ = عرض تلقائي يُطبَّق على كل سلة في نطاقه بلا رمز. */
  readonly code: string | null;
  readonly discount: PromotionDiscount;
  readonly scope: PromotionScope;
}

function zeroes(discount: PromotionDiscount, price: Money): boolean {
  return discount.kind === "percentage"
    ? discount.rate >= BASIS_POINTS_SCALE
    : discount.amount.amountMinor >= price.amountMinor;
}

/**
 * المنتجات التي يجعلها العرض التلقائي مجانية: نسبة 100% أو مبلغ ثابت يبلغ سعر منتج يُباع في نطاقه.
 * عرض كهذا يُسقط البيع كله (`cart.zero_total`)، فلا يُحفظ ولا يُفعَّل. الكوبون خارجه: يكتبه العميل،
 * ورفضه يظهر له في السلة.
 */
export function automaticZeroedProducts(
  terms: AutomaticTerms,
  products: readonly SellablePrice[],
): readonly SellablePrice[] {
  if (terms.code !== null) {
    return [];
  }
  return products.filter(
    (product) => isInScope(terms.scope, product.id) && zeroes(terms.discount, product.price),
  );
}
