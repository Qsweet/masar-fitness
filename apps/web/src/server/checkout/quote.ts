import "server-only";
import { listPlanAddons, quoteCart, type PlanAddonOption } from "@masar/db";
import { ok, parseCouponCode, type DomainError, type Quote, type Result } from "@masar/domain";
import { getDb } from "../db";
import { guardCheckout } from "./failure";
import { couponThrottledError, publicQuoteCouponError } from "./public-errors";
import { allowCouponCheck, requestIp } from "./throttle";

export interface CheckoutQuoteRequest {
  readonly slug: string;
  readonly addonSlugs: readonly string[];
  /** نص الكوبون كما كتبه الزائر؛ يُنظَّف ويُتحقق من صيغته هنا. */
  readonly couponInput: string;
}

export interface CheckoutQuote {
  readonly quote: Quote;
  /** الإضافات المعروضة مع الباقة (خانات نموذج الخيارات). */
  readonly addons: readonly PlanAddonOption[];
  /** الكوبون منظَّفًا كما سيُرسل مع الطلب، أو "" بلا كوبون أو بصيغة خاطئة أو بلا فحص. */
  readonly couponCode: string;
}

/**
 * الكوبون الذي يُفحص فعلًا: صيغته صحيحة وضمن حد فحوص العنوان. خطأ الصيغة أو الحد يُعاد على
 * حقله، والعرض يُسعَّر بلا كوبون فيرى العميل السعر بلا خصمه.
 */
async function couponToCheck(input: string) {
  const parsed = parseCouponCode(input);
  if (!parsed.ok) {
    return { code: null, error: parsed.error };
  }
  if (parsed.value !== null && !allowCouponCheck(await requestIp())) {
    return { code: null, error: couponThrottledError() };
  }
  return { code: parsed.value, error: null };
}

/**
 * عرض السعر قبل الجوال (المكانة unknown) بمحرك الطلب نفسه. الصفحة عامة بلا هوية، فكل رفض
 * للكوبون نص واحد (`publicQuoteCouponError`) وفحوصه محدودة لكل عنوان، فلا تصلح لتخمين الرموز.
 */
export async function getCheckoutQuote(
  request: CheckoutQuoteRequest,
): Promise<Result<CheckoutQuote, DomainError>> {
  const coupon = await couponToCheck(request.couponInput);
  const now = new Date();
  return guardCheckout<Result<CheckoutQuote, DomainError>>("checkout.quote_failed", async () => {
    const db = getDb();
    const quoted = await quoteCart(
      db,
      { planSlug: request.slug, addonSlugs: request.addonSlugs, couponCode: coupon.code },
      now,
    );
    if (!quoted.ok) {
      return quoted;
    }
    const couponError = coupon.error ?? publicQuoteCouponError(quoted.value.couponError);
    const addons = await listPlanAddons(db, request.slug, now);
    return ok({ quote: { ...quoted.value, couponError }, addons, couponCode: coupon.code ?? "" });
  });
}
