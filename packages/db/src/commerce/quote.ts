/** عرض السعر قبل الجوال: قراءة فقط بلا أقفال، بمحرك التسعير نفسه الذي يكتب الطلب (`buildQuote`). */
import {
  buildQuote,
  type CouponCode,
  type DomainError,
  type Quote,
  type Result,
} from "@masar/domain";
import type { Db } from "../client";
import { cartVersionIds, loadBenefits, loadCartLines, withBenefits } from "./load-catalog";
import {
  candidateIdList,
  loadCandidateIds,
  loadPromotionCandidates,
  toPromotionFacts,
} from "./load-promotions";
import { loadCommercePolicy } from "./policy";

export interface QuoteRequest {
  readonly planSlug: string;
  readonly addonSlugs: readonly string[];
  readonly couponCode: CouponCode | null;
}

export async function quoteCart(
  db: Db,
  request: QuoteRequest,
  now: Date,
): Promise<Result<Quote, DomainError>> {
  const cart = await loadCartLines(db, { ...request, now });
  if (!cart.ok) {
    return cart;
  }
  const { clubId, primary, addons } = cart.value;
  const policy = await loadCommercePolicy(db, clubId);
  const lines = withBenefits(cart.value, await loadBenefits(db, cartVersionIds(cart.value)));
  const productIds = [primary, ...addons].map((line) => line.productId);
  const ids = await loadCandidateIds(db, clubId, productIds, request.couponCode, now);
  const candidates = await loadPromotionCandidates(db, candidateIdList(ids), null);
  return buildQuote({
    ...lines,
    attachableAddonProductIds: cart.value.attachableAddonProductIds,
    policy,
    ...toPromotionFacts(ids, request.couponCode, candidates),
    now,
  });
}
