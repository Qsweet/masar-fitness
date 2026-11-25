import "server-only";
import { cookies } from "next/headers";
import { CART_COOKIE, CART_COOKIE_MAX_AGE_SECONDS } from "@/config/cart";
import { getEnv } from "../env";
import { decodeCart, encodeCart, type Cart } from "./codec";

/** السلة من كوكي الطلب الحالي (صفحة خادم أو إجراء). لا كتابة هنا. */
export async function readCart(): Promise<Cart> {
  return decodeCart((await cookies()).get(CART_COOKIE)?.value);
}

/** Secure إلا على عنوان الجهاز بـhttp (الاختبار والمعاينة المحلية). */
function isHttps(): boolean {
  return new URL(getEnv().SITE_URL).protocol === "https:";
}

/** تكتب السلة (Server Action فقط). السلة الفارغة تحذف الكوكي. */
export async function saveCart(cart: Cart): Promise<void> {
  const store = await cookies();
  const value = encodeCart(cart);
  if (value === "") {
    store.delete(CART_COOKIE);
    return;
  }
  store.set(CART_COOKIE, value, {
    httpOnly: true,
    secure: isHttps(),
    sameSite: "lax",
    path: "/",
    maxAge: CART_COOKIE_MAX_AGE_SECONDS,
  });
}
