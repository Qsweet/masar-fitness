import "server-only";
import { findOrderByPublicToken, type OrderView } from "@masar/db";
import { getDb } from "../db";
import { guardCheckout } from "./failure";

/** شكل رمز placeOrder: 32 بايت base64url بلا حشو. أي شكل آخر لا يصل إلى القاعدة. */
const PUBLIC_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function isPublicToken(token: string): boolean {
  return PUBLIC_TOKEN_PATTERN.test(token);
}

/** الطلب من لقطته برمزه العام، أو undefined لرمز بشكل خاطئ أو غير موجود. */
export async function getOrderView(token: string): Promise<OrderView | undefined> {
  if (!isPublicToken(token)) {
    return undefined;
  }
  return guardCheckout("checkout.order_read_failed", () =>
    findOrderByPublicToken(getDb(), token, new Date()),
  );
}
