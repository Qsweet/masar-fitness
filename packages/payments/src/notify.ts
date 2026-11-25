/**
 * معالجة إشعار موثّق المصدر. الإشعار منبّه فقط: تُحدَّد به المحاولة ثم تُقرأ حالتها من المزوّد
 * (`syncAttempt`). لا حقل من جسمه يدخل في أي قرار، ومعرّفاته مراجع بحث لا أكثر.
 */
import { findAttemptByPayment, findAttemptBySession, type PaymentAttemptRecord } from "@masar/db";
import type { PaymentDeps } from "./deps";
import type { ProviderNotification } from "./port";
import { syncAttempt, type SyncResult } from "./sync";

type PaymentUpdate = Extract<ProviderNotification, { kind: "payment_update" }>;

export type NotificationResult =
  | SyncResult
  /** لا محاولة لنا بهذا المرجع: حدث لنظام آخر على حساب التاجر نفسه (الـCRM مثلًا)، يُتجاهل. */
  | { readonly kind: "unknown_reference" };

async function sessionOfPayment(deps: PaymentDeps, paymentId: string): Promise<string | null> {
  const session = await deps.provider.fetchPaymentSession(paymentId);
  return session.ok ? session.value : null;
}

/** المحاولة المقصودة: بمعرّف الجلسة، ثم بمعرّف الدفعة، ثم بقراءة جلسة الدفعة من المزوّد. */
async function locateAttempt(
  deps: PaymentDeps,
  update: PaymentUpdate,
): Promise<PaymentAttemptRecord | undefined> {
  const { db, provider } = deps;
  if (update.sessionId !== null) {
    return findAttemptBySession(db, provider.id, update.sessionId);
  }
  if (update.paymentId === null) {
    return undefined;
  }
  const byPayment = await findAttemptByPayment(db, provider.id, update.paymentId);
  if (byPayment !== undefined) {
    return byPayment;
  }
  const sessionId = await sessionOfPayment(deps, update.paymentId);
  return sessionId === null ? undefined : findAttemptBySession(db, provider.id, sessionId);
}

export async function handlePaymentNotification(
  deps: PaymentDeps,
  update: PaymentUpdate,
): Promise<NotificationResult> {
  const attempt = await locateAttempt(deps, update);
  if (attempt === undefined) {
    deps.logger.info("payment.webhook_ignored", {
      provider: deps.provider.id,
      eventId: update.eventId,
      eventType: update.eventType,
      reason: "unknown_reference",
    });
    return { kind: "unknown_reference" };
  }
  return syncAttempt(deps, attempt.id, "webhook");
}
