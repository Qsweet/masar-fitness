import "server-only";
import { headers } from "next/headers";
import {
  CHECKOUT_THROTTLE_WINDOW_MS,
  MAX_CHECKOUT_SUBMITS_PER_IP,
  MAX_CHECKOUT_SUBMITS_PER_MOBILE,
  MAX_COUPON_CHECKS_PER_IP,
  MAX_THROTTLE_KEYS,
} from "@/config/checkout";
import { clientIp } from "../http/client-ip";
import { createRateLimiter, type RateLimiter } from "../rate-limit/fixed-window";

interface CheckoutLimiters {
  readonly submitByIp: RateLimiter;
  readonly submitByMobile: RateLimiter;
  readonly couponByIp: RateLimiter;
}

function rule(limit: number) {
  return { limit, windowMs: CHECKOUT_THROTTLE_WINDOW_MS };
}

// على globalThis كي تشترك فيها كل حزم المسارات وتبقى عبر إعادة تحميل الوحدات في التطوير
const globalForThrottle = globalThis as typeof globalThis & {
  masarCheckoutLimiters?: CheckoutLimiters;
};

function limiters(): CheckoutLimiters {
  globalForThrottle.masarCheckoutLimiters ??= {
    submitByIp: createRateLimiter(rule(MAX_CHECKOUT_SUBMITS_PER_IP), MAX_THROTTLE_KEYS),
    submitByMobile: createRateLimiter(rule(MAX_CHECKOUT_SUBMITS_PER_MOBILE), MAX_THROTTLE_KEYS),
    couponByIp: createRateLimiter(rule(MAX_COUPON_CHECKS_PER_IP), MAX_THROTTLE_KEYS),
  };
  return globalForThrottle.masarCheckoutLimiters;
}

/** عنوان الطلب الحالي كما كتبه الوسيط (انظر clientIp). */
export async function requestIp(): Promise<string> {
  return clientIp((await headers()).get("x-forwarded-for"));
}

/** محاولة إرسال لنموذج الشراء من هذا العنوان: تُعدّ كل محاولة، صالحة أو لا. */
export function allowSubmitFromIp(ip: string): boolean {
  return limiters().submitByIp.consume(ip, Date.now());
}

/** محاولة إنشاء طلب لهذا الجوال (بصيغته الموحّدة بعد التحقق). */
export function allowSubmitForMobile(mobileE164: string): boolean {
  return limiters().submitByMobile.consume(mobileE164, Date.now());
}

/** فحص كوبون في صفحة الشراء من هذا العنوان. */
export function allowCouponCheck(ip: string): boolean {
  return limiters().couponByIp.consume(ip, Date.now());
}
