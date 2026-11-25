"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { CART_PATH } from "@/config/routes";
import { DEFAULT_LOCALE, LOCALES, localizedPath, type Locale } from "@/i18n/locales";
import { getMembershipPlan } from "../catalog";
import { requireCheckout } from "../checkout/flag";
import { isSlug } from "../checkout/form-schema";
import { allowCartAction, requestIp } from "../checkout/throttle";
import { EMPTY_CART } from "./codec";
import { saveCart } from "./cookie";
import type { CartNote } from "./notes";

const cartFormSchema = z.object({
  slug: z.string().refine(isSlug),
  locale: z.enum(LOCALES),
});

function field(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

function backToCart(locale: Locale, note: CartNote): never {
  redirect(`${localizedPath(locale, CART_PATH)}?note=${note}`);
}

/** الترتيب ثابت: العلم (404) ثم حد العنوان ثم شكل النموذج. نموذج مشوّه ⇒ صفحة السلة بالعربية. */
async function parseCartForm(formData: FormData) {
  requireCheckout();
  const parsed = cartFormSchema.safeParse({
    slug: field(formData, "slug"),
    locale: field(formData, "locale"),
  });
  const locale = parsed.success ? parsed.data.locale : DEFAULT_LOCALE;
  if (!allowCartAction(await requestIp())) {
    backToCart(locale, "busy");
  }
  if (!parsed.success) {
    backToCart(locale, "unavailable");
  }
  return parsed.data;
}

/**
 * «اشترِ الآن»: يضع الاشتراك في السلة (يستبدل أي اشتراك قبله، فالطلب اشتراك واحد) ثم صفحة السلة
 * بملاحظة «أُضيف». اشتراك غير قابل للبيع لا يدخل الكوكي. يعمل بلا JavaScript (نموذج POST حقيقي).
 */
export async function addToCart(formData: FormData): Promise<void> {
  const { slug, locale } = await parseCartForm(formData);
  if ((await getMembershipPlan(slug)) === undefined) {
    backToCart(locale, "unavailable");
  }
  await saveCart({ slug });
  backToCart(locale, "added");
}

/** «احذف»: يفرّغ السلة. */
export async function removeFromCart(formData: FormData): Promise<void> {
  const { locale } = await parseCartForm(formData);
  await saveCart(EMPTY_CART);
  backToCart(locale, "removed");
}
