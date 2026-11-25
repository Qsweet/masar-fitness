/**
 * قراءة كائني الفاتورة والدفعة من رد Moyasar بقائمة بيضاء: لا يخرج من هنا إلا المعرّفات والحالة
 * والمبلغ والعملة ونوع المصدر. اسم حامل البطاقة ورقمها المقنَّع وعنوان IP ونص `message` لا تُقرأ أصلًا.
 * - الفاتورة: docs.moyasar.com/api/invoices/01-create-invoice و …/04-show-invoice
 * - الدفعة: docs.moyasar.com/api/payments/02-fetch-payment
 * - الحالات: docs.moyasar.com/docs/api/payments/payment-status-reference.md
 * - مفاتيح `#coupon_*` في metadata الدفعة عند تطبيق كوبون: docs.moyasar.com/docs/guides/coupons/index.md
 * حقل أو حالة بغير الشكل الموثق ⇒ `malformed_response`، ولا يُخمَّن معناه.
 */
import { err, ok, type Result } from "@masar/domain";
import { ProviderError } from "../port";

export const MOYASAR_INVOICE_STATUSES = [
  "initiated",
  "paid",
  "failed",
  "refunded",
  "canceled",
  "on_hold",
  "expired",
  "voided",
] as const;
export type MoyasarInvoiceStatus = (typeof MOYASAR_INVOICE_STATUSES)[number];

export const MOYASAR_PAYMENT_STATUSES = [
  "initiated",
  "paid",
  "authorized",
  "failed",
  "refunded",
  "captured",
  "voided",
  "verified",
  "expired",
] as const;
export type MoyasarPaymentStatus = (typeof MOYASAR_PAYMENT_STATUSES)[number];

export interface MoyasarInvoice {
  readonly id: string;
  readonly status: MoyasarInvoiceStatus;
  readonly amount: number;
  readonly currency: string;
  readonly url: string | null;
  /** `metadata.attempt_id` الذي أرسلناه عند الإنشاء. */
  readonly attemptId: string | null;
  readonly paymentIds: readonly string[];
}

export interface MoyasarPayment {
  readonly id: string;
  readonly status: MoyasarPaymentStatus;
  readonly amount: number;
  readonly currency: string;
  readonly refunded: number;
  readonly invoiceId: string | null;
  /** `source.type`: creditcard أو applepay أو samsungpay أو stcpay أو sadadbill. */
  readonly method: string | null;
  readonly couponApplied: boolean;
}

type Json = Readonly<Record<string, unknown>>;

/** المعرّفات uuid في الوثيقة. يُفحص شكلها قبل وضعها في مسار رابط. */
const MOYASAR_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const SOURCE_TYPE_PATTERN = /^[a-z]{2,32}$/;
const COUPON_KEY_PREFIX = "#coupon_";
/** أقصى دفعات نقرؤها لفاتورة واحدة. أكثر من ذلك ليس سلوك عميل يدفع اشتراكًا. */
export const MAX_PAYMENTS_PER_INVOICE = 20;

export function isMoyasarId(value: unknown): value is string {
  return typeof value === "string" && MOYASAR_ID_PATTERN.test(value);
}

function malformed(code: string): Result<never, ProviderError> {
  return err(new ProviderError("malformed_response", { code }));
}

function isJson(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isCurrency(value: unknown): value is string {
  return typeof value === "string" && CURRENCY_PATTERN.test(value);
}

function metadataOf(object: Json): Json {
  return isJson(object.metadata) ? object.metadata : {};
}

function paymentIdsOf(invoice: Json): string[] | undefined {
  const { payments } = invoice;
  if (payments === undefined || payments === null) {
    return [];
  }
  if (!Array.isArray(payments) || payments.length > MAX_PAYMENTS_PER_INVOICE) {
    return undefined;
  }
  const ids = payments.map((payment: unknown) => (isJson(payment) ? payment.id : undefined));
  return ids.every(isMoyasarId) ? ids : undefined;
}

export function parseInvoice(json: unknown): Result<MoyasarInvoice, ProviderError> {
  if (!isJson(json) || !isMoyasarId(json.id)) {
    return malformed("invoice_id");
  }
  const status = MOYASAR_INVOICE_STATUSES.find((known) => known === json.status);
  if (status === undefined) {
    return malformed("invoice_status_unknown");
  }
  if (!isAmount(json.amount) || !isCurrency(json.currency)) {
    return malformed("invoice_amount");
  }
  const paymentIds = paymentIdsOf(json);
  if (paymentIds === undefined) {
    return malformed("invoice_payments");
  }
  const attemptId = metadataOf(json).attempt_id;
  return ok({
    id: json.id,
    status,
    amount: json.amount,
    currency: json.currency,
    url: typeof json.url === "string" ? json.url : null,
    attemptId: typeof attemptId === "string" ? attemptId : null,
    paymentIds,
  });
}

function methodOf(payment: Json): string | null {
  const type = isJson(payment.source) ? payment.source.type : undefined;
  return typeof type === "string" && SOURCE_TYPE_PATTERN.test(type) ? type : null;
}

function invoiceIdOf(payment: Json): string | null | undefined {
  const { invoice_id: invoiceId } = payment;
  if (invoiceId === undefined || invoiceId === null) {
    return null;
  }
  return isMoyasarId(invoiceId) ? invoiceId : undefined;
}

export function parsePayment(json: unknown): Result<MoyasarPayment, ProviderError> {
  if (!isJson(json) || !isMoyasarId(json.id)) {
    return malformed("payment_id");
  }
  const status = MOYASAR_PAYMENT_STATUSES.find((known) => known === json.status);
  if (status === undefined) {
    return malformed("payment_status_unknown");
  }
  if (!isAmount(json.amount) || !isCurrency(json.currency) || !isAmount(json.refunded)) {
    return malformed("payment_amount");
  }
  const invoiceId = invoiceIdOf(json);
  if (invoiceId === undefined) {
    return malformed("payment_invoice_id");
  }
  const couponKeys = Object.keys(metadataOf(json)).filter((key) =>
    key.startsWith(COUPON_KEY_PREFIX),
  );
  return ok({
    id: json.id,
    status,
    amount: json.amount,
    currency: json.currency,
    refunded: json.refunded,
    invoiceId,
    method: methodOf(json),
    couponApplied: couponKeys.length > 0,
  });
}
