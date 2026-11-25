import "server-only";
import { CHECKOUT_THROTTLE_WINDOW_MS, MAX_THROTTLE_KEYS } from "@/config/checkout";
import { MAX_PAYMENT_CHECKS_PER_IP, MAX_PAYMENT_STARTS_PER_IP } from "@/config/payments";
import { createRateLimiter, type RateLimiter } from "../rate-limit/fixed-window";

interface PaymentLimiters {
  readonly startByIp: RateLimiter;
  readonly checkByIp: RateLimiter;
}

function rule(limit: number) {
  return { limit, windowMs: CHECKOUT_THROTTLE_WINDOW_MS };
}

const globalForThrottle = globalThis as typeof globalThis & {
  masarPaymentLimiters?: PaymentLimiters;
};

function limiters(): PaymentLimiters {
  globalForThrottle.masarPaymentLimiters ??= {
    startByIp: createRateLimiter(rule(MAX_PAYMENT_STARTS_PER_IP), MAX_THROTTLE_KEYS),
    checkByIp: createRateLimiter(rule(MAX_PAYMENT_CHECKS_PER_IP), MAX_THROTTLE_KEYS),
  };
  return globalForThrottle.masarPaymentLimiters;
}

/** ضغطة «ادفع» من هذا العنوان. */
export function allowPaymentStart(ip: string): boolean {
  return limiters().startByIp.consume(ip, Date.now());
}

/** تحقق من الدفع عند العودة من هذا العنوان. تجاوز الحد يعرض الحالة المحفوظة بلا قراءة للمزوّد. */
export function allowPaymentCheck(ip: string): boolean {
  return limiters().checkByIp.consume(ip, Date.now());
}
