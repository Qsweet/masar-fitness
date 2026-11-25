/**
 * ثوابت تقنية لمسار الدفع في الويب: حدود حماية، لا سياسات عمل ولا حقائق مزوّد.
 * نافذة حدود المحاولات وسقف مفاتيحها مشتركان مع مسار الشراء (config/checkout.ts).
 */

/** أقصى مرات بدء الدفع من عنوان واحد في النافذة: كل بدء قد يستدعي المزوّد. */
export const MAX_PAYMENT_STARTS_PER_IP = 20;

/** أقصى مرات التحقق من الدفع عند العودة من عنوان واحد في النافذة: كل تحقق يقرأ من المزوّد. */
export const MAX_PAYMENT_CHECKS_PER_IP = 60;

/**
 * سقف عام لمرات بدء الدفع في النافذة مع مزوّد حقيقي (البيئة التجريبية): كل بدء ينشئ فاتورة عند
 * المزوّد، وحد العنوان وحده يُتجاوز بعناوين كثيرة. بلوغه يعرض «محاولات كثيرة» للجميع حتى تنقضي النافذة.
 */
export const MAX_PAYMENT_STARTS_GLOBAL = 120;

const LOOPBACK_HOSTNAMES: readonly string[] = ["localhost", "127.0.0.1", "[::1]"];

/** هل ترويسة Host (باسم ومنفذ اختياري) عنوان الجهاز نفسه؟ */
export function isLoopbackHost(host: string | null): boolean {
  if (host === null || !URL.canParse(`http://${host}`)) {
    return false;
  }
  return LOOPBACK_HOSTNAMES.includes(new URL(`http://${host}`).hostname);
}

const KIBIBYTE = 1_024;
const WEBHOOK_MAX_BODY_KIB = 64;
/** أقصى حجم لجسم الإشعار. إشعار الدفعة بضعة كيلوبايتات؛ ما فوق الحد يُرفض 413 قبل تحليله. */
export const WEBHOOK_MAX_BODY_BYTES = WEBHOOK_MAX_BODY_KIB * KIBIBYTE;

/** فرق المبلغ في زر «مبلغ مختلف» بصفحة الدفع التجريبية (هللة): يحاكي دفعة لا تطابق الطلب. */
export const DEMO_MISMATCH_MINOR = 100;

/** مسار صفحة الدفع التجريبية لجلسة من مزوّد الاختبار. */
export function demoPayPath(sessionId: string): string {
  return `/checkout/demo-pay/${sessionId}`;
}

/** صفحة الطلب، وصفحة العودة من المزوّد التي تتحقق من الدفع ثم تحوّل إليها. */
export function orderPath(token: string): string {
  return `/checkout/orders/${token}`;
}

export function orderReturnPath(token: string): string {
  return `${orderPath(token)}/return`;
}

/** تنبيهات تُعرض في صفحة الطلب بعد محاولة بدء الدفع (`?pay=`). قائمة مغلقة. */
export const PAY_NOTICES = ["failed", "throttled"] as const;
export type PayNotice = (typeof PAY_NOTICES)[number];
export const PAY_NOTICE_PARAM = "pay";

export function parsePayNotice(value: unknown): PayNotice | null {
  return PAY_NOTICES.find((notice) => notice === value) ?? null;
}
