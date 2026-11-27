import "server-only";
import {
  ADMIN_THROTTLE_WINDOW_MS,
  MAX_ADMIN_THROTTLE_KEYS,
  MAX_CURRENT_PASSWORD_CHECKS_PER_STAFF,
  MAX_LOGIN_ATTEMPTS_PER_EMAIL,
  MAX_LOGIN_ATTEMPTS_PER_IP,
  MAX_MANUAL_SETTLE_ATTEMPTS_PER_STAFF,
  MAX_MFA_ATTEMPTS_PER_IP,
  MAX_MFA_ATTEMPTS_PER_STAFF,
  MAX_PHONE_LOOKUPS_PER_STAFF,
  MAX_PHONE_REVEALS_PER_STAFF,
  MAX_TRACKING_TESTS_PER_STAFF,
} from "@/config/admin";
import { MAX_UPLOADS_PER_STAFF } from "@/config/media-library";
import { createRateLimiter, type RateLimiter } from "../rate-limit/fixed-window";

interface AdminLimiters {
  readonly loginByIp: RateLimiter;
  readonly loginByEmail: RateLimiter;
  readonly mfaByIp: RateLimiter;
  readonly mfaByStaff: RateLimiter;
  readonly passwordByStaff: RateLimiter;
  readonly phoneLookupByStaff: RateLimiter;
  readonly phoneRevealByStaff: RateLimiter;
  readonly manualSettleByStaff: RateLimiter;
  readonly mediaUploadByStaff: RateLimiter;
  readonly trackingTestByStaff: RateLimiter;
}

function limiter(limit: number): RateLimiter {
  // refuse: نافذة حيّة لا تُحذف لإفساح مكان، فإغراق المحدِّد بمفاتيح مختلقة لا يمحو عدّاد أحد
  const rule = { limit, windowMs: ADMIN_THROTTLE_WINDOW_MS };
  return createRateLimiter(rule, MAX_ADMIN_THROTTLE_KEYS, "refuse");
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
    passwordByStaff: limiter(MAX_CURRENT_PASSWORD_CHECKS_PER_STAFF),
    phoneLookupByStaff: limiter(MAX_PHONE_LOOKUPS_PER_STAFF),
    phoneRevealByStaff: limiter(MAX_PHONE_REVEALS_PER_STAFF),
    manualSettleByStaff: limiter(MAX_MANUAL_SETTLE_ATTEMPTS_PER_STAFF),
    mediaUploadByStaff: limiter(MAX_UPLOADS_PER_STAFF),
    trackingTestByStaff: limiter(MAX_TRACKING_TESTS_PER_STAFF),
  };
  return globalForThrottle.masarAdminLimiters;
}

/**
 * محاولة دخول: تُعدّ على العنوان وعلى البريد المكتوب (موحَّدًا) معًا، صحيحة أو لا. الحدّان في ذاكرة
 * العملية يبطئان السكربت؛ قفل الحساب في القاعدة هو ما يصمد لإعادة التشغيل.
 */
export function allowLoginAttempt(ip: string, email: string): boolean {
  const now = Date.now();
  // العنوان أولًا: عنوان تجاوز حدّه لا يستهلك من نافذة البريد (ولا يملأ المحدِّد بمفاتيح بريد)
  return limiters().loginByIp.consume(ip, now) && limiters().loginByEmail.consume(email, now);
}

/** محاولة رمز خطوة ثانية أو رمز استرجاع: حد مستقل عن حد الدخول، على العنوان وعلى الحساب. */
export function allowMfaAttempt(ip: string, staffId: string): boolean {
  const now = Date.now();
  return limiters().mfaByIp.consume(ip, now) && limiters().mfaByStaff.consume(staffId, now);
}

/**
 * فحص كلمة المرور الحالية في «حسابي»: حد لكل حساب، فجلسة مسروقة لا تخمّن الكلمة بلا حد. في الذاكرة
 * فقط ولا يدخل قفل الحساب: صاحب جلسة مسروقة لا يُعطى وسيلة لقفل صاحبها خارج اللوحة.
 */
export function allowCurrentPasswordCheck(staffId: string): boolean {
  return limiters().passwordByStaff.consume(staffId, Date.now());
}

/**
 * حدود إجراءات المبيعات لكل موظف (ADMIN_A2_SALES §11): البحث بالجوال الكامل، وكشفه، وتسجيل الدفع
 * اليدوي. في ذاكرة العملية كسائر الحدود: تكفي لموظف مسجَّل الدخول ومدقَّق، وتُصفَّر بإعادة التشغيل.
 */
export function allowPhoneLookup(staffId: string): boolean {
  return limiters().phoneLookupByStaff.consume(staffId, Date.now());
}

export function allowPhoneReveal(staffId: string): boolean {
  return limiters().phoneRevealByStaff.consume(staffId, Date.now());
}

export function allowManualSettle(staffId: string): boolean {
  return limiters().manualSettleByStaff.consume(staffId, Date.now());
}

/** حدث اختبار إلى منصة قياس: طلب خارجي حقيقي، فحدّ لكل موظف ناجحًا أو مرفوضًا. */
export function allowTrackingTest(staffId: string): boolean {
  return limiters().trackingTestByStaff.consume(staffId, Date.now());
}

/** رفع صورة إلى المكتبة (ADMIN_A3_SLIDER §6.1): إعادة الترميز ثقيلة، فحدّ لكل موظف ناجحًا أو مرفوضًا. */
export function allowMediaUpload(staffId: string): boolean {
  return limiters().mediaUploadByStaff.consume(staffId, Date.now());
}
