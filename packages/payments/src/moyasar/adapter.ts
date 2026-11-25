/**
 * محوّل Moyasar بمسار الفاتورة المستضافة: صفحة الدفع على نطاق المزوّد، فلا بيانات بطاقة عندنا.
 * مكتوب من الوثائق الرسمية وحدها (الروابط عند كل استدعاء)، وما لم يوثَّق معزول في unverified.ts.
 * - إنشاء الفاتورة `POST /invoices`: docs.moyasar.com/api/invoices/01-create-invoice
 *   و docs.moyasar.com/docs/guides/invoices/creating-invoices.md (حقل metadata)
 * - قراءتها `GET /invoices/:id`: docs.moyasar.com/api/invoices/04-show-invoice
 * - إلغاؤها `PUT /invoices/:id/cancel`: docs.moyasar.com/api/invoices/06-cancel-invoice
 * - قراءة الدفعة `GET /payments/:id`: docs.moyasar.com/api/payments/02-fetch-payment
 *
 * قرارات بالاتجاه الآمن لما لم يوثَّق:
 * - لا `callback_url` للفاتورة: إشعارها بلا وسيلة توثيق موثقة. نعتمد على الإشعار العام والعودة والمطابقة.
 * - لا `apply_coupon`: ليس حقلًا موثقًا للفاتورة. الكوبون يُكشف من `#coupon_*` في الدفعة فيصير حادثة.
 * - لا إعادة لإنشاء الفاتورة: لا مفتاح عدم تكرار موثق لها.
 * - بيئة الجلسة هي بيئة المفتاح الذي قرأها (`sk_test_`)، فلا حقل بيئة موثق في الفاتورة أو الدفعة.
 */
import {
  err,
  ok,
  type ProviderMode,
  type ProviderPaymentSnapshot,
  type Result,
} from "@masar/domain";
import {
  ProviderError,
  type HostedPayment,
  type HostedPaymentRequest,
  type PaymentProvider,
  type SessionView,
} from "../port";
import { moyasarRequest, type MoyasarHttpOptions } from "./http";
import { paymentStateOf, sessionStateOf } from "./map";
import {
  isMoyasarId,
  parseInvoice,
  parsePayment,
  type MoyasarInvoice,
  type MoyasarPayment,
} from "./parse";
import { MOYASAR_SANDBOX_SEAMS, needsSandboxVerification } from "./unverified";
import { parseMoyasarNotification } from "./webhook";

export const MOYASAR_PROVIDER_ID = "moyasar";
/** الحد الأدنى لمبلغ الفاتورة بالهللة (`amount >= 100`): docs.moyasar.com/api/invoices/01-create-invoice */
export const MOYASAR_MIN_INVOICE_AMOUNT_MINOR = 100;
const HOSTED_PAGE_PROTOCOL = "https:";

export interface MoyasarProviderOptions extends MoyasarHttpOptions {
  readonly webhookSecret: string;
  readonly mode: ProviderMode;
}

function invalidId(): Result<never, ProviderError> {
  return err(new ProviderError("malformed_response", { code: "id_not_uuid" }));
}

function isHttpsUrl(value: string | null): value is string {
  return value !== null && URL.canParse(value) && new URL(value).protocol === HOSTED_PAGE_PROTOCOL;
}

/** الفاتورة المنشأة يجب أن تعيد ما أرسلناه: المبلغ والعملة ومعرّف المحاولة، وصفحة دفع https. */
function hostedProblem(invoice: MoyasarInvoice, request: HostedPaymentRequest): string | null {
  if (invoice.amount !== request.amountMinor || invoice.currency !== request.currency) {
    return "invoice_amount_echo";
  }
  if (invoice.attemptId !== request.attemptId) {
    return "invoice_metadata_echo";
  }
  if (invoice.status !== "initiated") {
    return "invoice_not_initiated";
  }
  return isHttpsUrl(invoice.url) ? null : "hosted_url_not_https";
}

function invoiceBody(request: HostedPaymentRequest): Readonly<Record<string, unknown>> {
  return {
    amount: request.amountMinor,
    currency: request.currency,
    description: request.description,
    // طابع زمني كامل ISO 8601؛ التاريخ وحده يعني منتصف الليل
    expired_at: request.expiresAt.toISOString(),
    success_url: request.successUrl,
    back_url: request.backUrl,
    // بلا اسم ولا جوال: «Do not store any sensitive information as metadata»
    metadata: { attempt_id: request.attemptId, order_ref: request.orderReference },
  };
}

function toSnapshotPayment(payment: MoyasarPayment): ProviderPaymentSnapshot {
  return {
    paymentId: payment.id,
    state: paymentStateOf(payment),
    rawStatus: payment.status,
    amountMinor: payment.amount,
    currency: payment.currency,
    sessionId: payment.invoiceId,
    method: payment.method,
    couponApplied: payment.couponApplied,
  };
}

async function fetchInvoice(
  options: MoyasarProviderOptions,
  path: string,
  method: "GET" | "PUT" = "GET",
): Promise<Result<MoyasarInvoice, ProviderError>> {
  const response = await moyasarRequest(options, method, path);
  return response.ok ? parseInvoice(response.value) : response;
}

async function fetchPayment(
  options: MoyasarProviderOptions,
  paymentId: string,
): Promise<Result<MoyasarPayment, ProviderError>> {
  if (!isMoyasarId(paymentId)) {
    return invalidId();
  }
  const response = await moyasarRequest(options, "GET", `/payments/${paymentId}`);
  return response.ok ? parsePayment(response.value) : response;
}

async function createHostedPayment(
  options: MoyasarProviderOptions,
  request: HostedPaymentRequest,
): Promise<Result<HostedPayment, ProviderError>> {
  if (request.amountMinor < MOYASAR_MIN_INVOICE_AMOUNT_MINOR) {
    return err(new ProviderError("rejected", { code: "amount_below_invoice_minimum" }));
  }
  const response = await moyasarRequest(options, "POST", "/invoices", invoiceBody(request));
  const invoice = response.ok ? parseInvoice(response.value) : response;
  if (!invoice.ok) {
    return invoice;
  }
  const problem = hostedProblem(invoice.value, request);
  const { id, url, status } = invoice.value;
  if (problem !== null || url === null) {
    // فاتورة لا نثق بها لا تُترك قابلة للدفع (أفضل جهد؛ وإلا تنتهي عند expired_at)
    await fetchInvoice(options, `/invoices/${id}/cancel`, "PUT");
    return err(new ProviderError("malformed_response", { code: problem ?? "hosted_url_missing" }));
  }
  return ok({ sessionId: id, redirectUrl: url, rawStatus: status });
}

/** الفاتورة ثم كل دفعة مذكورة فيها بقراءة مستقلة: من قائمة الفاتورة يؤخذ المعرّف فقط. */
async function fetchSession(
  options: MoyasarProviderOptions,
  sessionId: string,
): Promise<Result<SessionView, ProviderError>> {
  if (!isMoyasarId(sessionId)) {
    return invalidId();
  }
  const invoice = await fetchInvoice(options, `/invoices/${sessionId}`);
  if (!invoice.ok) {
    return invoice;
  }
  if (invoice.value.id !== sessionId) {
    return err(new ProviderError("malformed_response", { code: "invoice_id_echo" }));
  }
  const payments: ProviderPaymentSnapshot[] = [];
  for (const paymentId of invoice.value.paymentIds) {
    const payment = await fetchPayment(options, paymentId);
    if (!payment.ok) {
      return payment;
    }
    payments.push(toSnapshotPayment(payment.value));
  }
  const { status, url, attemptId } = invoice.value;
  const snapshot = {
    provider: MOYASAR_PROVIDER_ID,
    sessionId,
    mode: options.mode,
    state: sessionStateOf(status),
    rawStatus: status,
    attemptId,
    payments,
  };
  return ok({ snapshot, redirectUrl: status === "initiated" && isHttpsUrl(url) ? url : null });
}

async function cancelSession(
  options: MoyasarProviderOptions,
  sessionId: string,
): Promise<Result<void, ProviderError>> {
  if (!isMoyasarId(sessionId)) {
    return invalidId();
  }
  const cancelled = await fetchInvoice(options, `/invoices/${sessionId}/cancel`, "PUT");
  return cancelled.ok ? ok(undefined) : cancelled;
}

export function createMoyasarProvider(options: MoyasarProviderOptions): PaymentProvider {
  return {
    id: MOYASAR_PROVIDER_ID,
    mode: options.mode,
    createHostedPayment: (request) => createHostedPayment(options, request),
    fetchSession: (sessionId) => fetchSession(options, sessionId),
    async fetchPaymentSession(paymentId) {
      const payment = await fetchPayment(options, paymentId);
      return payment.ok ? ok(payment.value.invoiceId) : payment;
    },
    cancelSession: (sessionId) => cancelSession(options, sessionId),
    findSessionsForAttempt: () =>
      Promise.resolve(err(needsSandboxVerification(MOYASAR_SANDBOX_SEAMS.listInvoicesByMetadata))),
    parseNotification: (rawBody) => parseMoyasarNotification(rawBody, options),
  };
}
