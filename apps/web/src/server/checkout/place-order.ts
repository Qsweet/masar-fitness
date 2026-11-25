import "server-only";
import { randomBytes } from "node:crypto";
import { createOrder, type CreatedOrder } from "@masar/db";
import type { Buyer, CouponCode, DomainError, RequestLocale, Result } from "@masar/domain";
import { MAX_PENDING_ORDERS_PER_CUSTOMER } from "@/config/checkout";
import { getDb } from "../db";
import { guardCheckout } from "./failure";

/** 32 بايت عشوائي: رمز رابط صفحة الطلب، لا يُخمَّن ولا يُشتق من المرجع. */
const PUBLIC_TOKEN_BYTES = 32;

export interface PlaceOrderInput {
  readonly slug: string;
  readonly addonSlugs: readonly string[];
  readonly couponCode: CouponCode | null;
  readonly buyer: Buyer;
  readonly locale: RequestLocale;
  readonly idempotencyKey: string;
  readonly quotedTotalMinor: number;
}

/** رمز صفحة الطلب: base64url بلا حشو، 43 محرفًا. */
export function newPublicToken(): string {
  return randomBytes(PUBLIC_TOKEN_BYTES).toString("base64url");
}

/**
 * ينشئ الطلب المعلّق. أخطاء العمل تُرجَع نتيجة ليعرضها النموذج؛ عطل القاعدة يُسجَّل منقّحًا
 * (بلا جوال) ويُرمى خطأً عامًا. الضغطتان بالمفتاح نفسه ترجعان الطلب نفسه برمزه الأول.
 */
export function placeOrder(input: PlaceOrderInput): Promise<Result<CreatedOrder, DomainError>> {
  return guardCheckout("checkout.place_order_failed", () =>
    createOrder(getDb(), {
      planSlug: input.slug,
      addonSlugs: input.addonSlugs,
      couponCode: input.couponCode,
      buyer: input.buyer,
      locale: input.locale,
      idempotencyKey: input.idempotencyKey,
      publicToken: newPublicToken(),
      quotedTotalMinor: input.quotedTotalMinor,
      maxPendingOrders: MAX_PENDING_ORDERS_PER_CUSTOMER,
      now: new Date(),
    }),
  );
}
