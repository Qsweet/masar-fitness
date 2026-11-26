import "server-only";
import {
  ADMIN_THROTTLE_WINDOW_MS,
  MAX_ADMIN_THROTTLE_KEYS,
  MAX_LOGIN_ATTEMPTS_PER_EMAIL,
  MAX_LOGIN_ATTEMPTS_PER_IP,
  MAX_MFA_ATTEMPTS_PER_IP,
  MAX_MFA_ATTEMPTS_PER_STAFF,
} from "@/config/admin";
import { createRateLimiter, type RateLimiter } from "../rate-limit/fixed-window";

interface AdminLimiters {
  readonly loginByIp: RateLimiter;
  readonly loginByEmail: RateLimiter;
  readonly mfaByIp: RateLimiter;
  readonly mfaByStaff: RateLimiter;
}

function limiter(limit: number): RateLimiter {
  return createRateLimiter({ limit, windowMs: ADMIN_THROTTLE_WINDOW_MS }, MAX_ADMIN_THROTTLE_KEYS);
}

// على globalThis كي تشترك فيها كل حزم المسارات (كما في حدود الشراء)
const globalForThrottle = globalThis as typeof globalThis & {
  masarAdminLimiters?: AdminLimiters;
};

function limiters(): AdminLimiters {
  globalForThrottle.masarAdminLimiters ??= {
    loginByIp: limiter(MAX_LOGIN_ATTEMPTS_PER_IP),
    loginByEmail: limiter(MAX_LOGIN_ATTEMPTS_PER_EMAIL),
    mfaByIp: limiter(MAX_MFA_ATTEMPTS_PER_IP),
    mfaByStaff: limiter(MAX_MFA_ATTEMPTS_PER_STAFF),
  };
  return globalForThrottle.masarAdminLimiters;
}

/**
 * محاولة دخول: تُعدّ على العنوان وعلى البريد المكتوب (موحَّدًا) معًا، صحيحة أو لا. الحدّان في ذاكرة
 * العملية يبطئان السكربت؛ قفل الحساب في القاعدة هو ما يصمد لإعادة التشغيل.
 */
export function allowLoginAttempt(ip: string, email: string): boolean {
  const now = Date.now();
  const byIp = limiters().loginByIp.consume(ip, now);
  const byEmail = limiters().loginByEmail.consume(email, now);
  return byIp && byEmail;
}

/** محاولة رمز خطوة ثانية أو رمز استرجاع: حد مستقل عن حد الدخول، على العنوان وعلى الحساب. */
export function allowMfaAttempt(ip: string, staffId: string): boolean {
  const now = Date.now();
  const byIp = limiters().mfaByIp.consume(ip, now);
  const byStaff = limiters().mfaByStaff.consume(staffId, now);
  return byIp && byStaff;
}
