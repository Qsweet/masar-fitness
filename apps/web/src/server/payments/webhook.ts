import "server-only";
import { handlePaymentNotification, type ProviderNotification } from "@masar/payments";
import { after } from "next/server";
import { WEBHOOK_MAX_BODY_BYTES } from "@/config/payments";
import { logCheckoutFailure } from "../checkout/failure";
import { getPayments, type PaymentRuntime } from "./runtime";

const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;
const HTTP_TOO_LARGE = 413;

function reply(status: number, body: Readonly<Record<string, unknown>> = {}): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** يقرأ الجسم الخام حتى الحد. يرجع null إن تجاوزه (بالترويسة أو أثناء القراءة). */
export async function readLimitedText(request: Request, maxBytes: number): Promise<string | null> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) {
    return null;
  }
  if (request.body === null) {
    return "";
  }
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      return text + decoder.decode();
    }
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
}

type PaymentUpdate = Extract<ProviderNotification, { kind: "payment_update" }>;

/** يعمل بعد إرسال الرد: القراءة من المزوّد والتسوية لا تؤخّران 2xx. أي عطل يُسجَّل، والمطابقة تعيد. */
async function process(payments: PaymentRuntime, update: PaymentUpdate): Promise<void> {
  try {
    const result = await handlePaymentNotification(payments.deps, update);
    // النتيجة تُسجَّل دائمًا: busy و skipped و unknown_reference و provider_error ليست تسوية، والمطابقة تحسمها
    payments.deps.logger.info("payment.webhook_processed", {
      provider: payments.deps.provider.id,
      eventId: update.eventId,
      eventType: update.eventType,
      reason: result.kind === "skipped" ? `skipped:${result.reason}` : result.kind,
      ...(result.kind === "provider_error"
        ? { errorKind: result.error.kind, errorCode: result.error.code }
        : {}),
    });
  } catch (error) {
    logCheckoutFailure("payment.webhook_processing_failed", error);
  }
}

function accept(payments: PaymentRuntime, notification: ProviderNotification): Response {
  const { deps } = payments;
  const provider = deps.provider.id;
  if (notification.kind === "endpoint_verification") {
    // رمز التحقق لا يُقرأ ولا يُسجَّل هنا: استلامه لتأكيد الرابط ينتظر جدول provider_events (PAYMENTS.md)
    deps.logger.warn("payment.webhook_verification_received", {
      provider,
      eventId: notification.eventId,
    });
    return reply(HTTP_OK, { received: true });
  }
  deps.logger.info("payment.webhook_received", {
    provider,
    eventId: notification.eventId,
    eventType: notification.eventType,
  });
  if (notification.kind === "payment_update") {
    after(() => process(payments, notification));
  }
  return reply(HTTP_OK, { received: true });
}

/**
 * نقطة إشعار المزوّد. الترتيب: المزوّد المضبوط (وإلا 404)، ثم حد الحجم (413)، ثم توثيق المصدر بالسر
 * المشترك بزمن ثابت (401 بلا أي كتابة، والسجل بلا الجسم)، ثم رد 2xx فوري والمعالجة بعده.
 * **جسم الإشعار لا يدخل في أي قرار**: هو منبّه يقول «اقرأ هذه المحاولة من المزوّد الآن».
 */
export async function handleWebhook(request: Request, providerId: string): Promise<Response> {
  const payments = getPayments();
  if (payments?.deps.provider.id !== providerId) {
    return reply(HTTP_NOT_FOUND);
  }
  const body = await readLimitedText(request, WEBHOOK_MAX_BODY_BYTES);
  if (body === null) {
    return reply(HTTP_TOO_LARGE);
  }
  const notification = payments.deps.provider.parseNotification(body);
  if (notification.ok) {
    return accept(payments, notification.value);
  }
  if (notification.error === "malformed") {
    return reply(HTTP_BAD_REQUEST);
  }
  payments.deps.logger.warn("payment.webhook_auth_failed", {
    provider: providerId,
    reason: notification.error,
  });
  return reply(HTTP_UNAUTHORIZED);
}
