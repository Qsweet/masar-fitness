/**
 * بنّاءات حقائق لاختبارات التجميع فقط (لا تُصدَّر من الحزمة). الأرقام توضيحية لا أسعار النادي.
 */
import { parseBuyer, type Buyer } from "../lifecycle";
import { basisPoints, parseCouponCode, type CartLine, type CouponCode } from "../pricing";
import { cartLine } from "../pricing/test-support";
import type { CommercePolicy } from "./commerce-policy";
import type { OrderFacts } from "./order-draft";

export const NOW = new Date("2026-12-10T12:00:00Z");

/** أسعار ونسبة توضيحية بالهللة ونقاط الأساس، كأمثلة التصميم. */
export const PLAN_PRICE_MINOR = 99900;
export const PT_PRICE_MINOR = 45000;
export const PROGRAM_PRICE_MINOR = 19900;
export const TEST_VAT_BPS = 1500;

export const PLAN: CartLine = cartLine("membership", "plan", PLAN_PRICE_MINOR, {
  paidMonths: 3,
  bonusMonths: 1,
  name: { ar: "باقة ربع سنوية", en: "Quarterly plan" },
  summary: { ar: "ثلاثة أشهر", en: "Three months" },
  benefits: [
    { ar: "دخول الصالة", en: "Gym access" },
    { ar: "تقييم أولي", en: "Initial assessment" },
  ],
});

export const PT: CartLine = cartLine("addon", "pt", PT_PRICE_MINOR, { sortOrder: 1 });

export const PROGRAM: CartLine = cartLine("digital_program", "program", PROGRAM_PRICE_MINOR);

/** سياسة محسومة بقيم اختبار؛ كل اختبار يفرّغ ما يريد فحصه. */
export const DECIDED_POLICY: CommercePolicy = {
  vatRate: basisPoints(TEST_VAT_BPS),
  currency: "SAR",
  timeZone: "Asia/Riyadh",
  orderPaymentWindowMinutes: 30,
  membershipStartRule: "on_payment",
};

export function testBuyer(): Buyer {
  const result = parseBuyer({ name: "سارة أحمد", mobile: "0551234567" });
  if (!result.ok) {
    throw new Error("مشترٍ اختبار غير صالح");
  }
  return result.value;
}

export function code(value: string): CouponCode {
  const result = parseCouponCode(value);
  if (!result.ok || result.value === null) {
    throw new Error("رمز اختبار غير صالح");
  }
  return result.value;
}

export function orderFacts(overrides: Partial<OrderFacts> = {}): OrderFacts {
  return {
    primary: PLAN,
    addons: [],
    attachableAddonProductIds: [PT.productId],
    policy: DECIDED_POLICY,
    automatic: [],
    coupon: { kind: "none" },
    customer: { standing: "new", pendingOrders: 0 },
    maxPendingOrders: 3,
    buyer: testBuyer(),
    locale: "ar",
    now: NOW,
    ...overrides,
  };
}
