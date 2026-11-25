/**
 * سجل الدفع: أسماء أحداث ثابتة وحقول من قائمة مغلقة (PHASE4_PAYMENTS_DESIGN §5.11).
 * لا جوال ولا اسم، ولا مفتاح ولا سر إشعار، ولا جسم إشعار ولا رابط كامل، ولا نص حر من المزوّد.
 */
export interface PaymentLogFields {
  readonly attemptId?: string;
  readonly orderId?: string;
  readonly provider?: string;
  readonly providerSessionId?: string | null;
  readonly providerPaymentId?: string | null;
  readonly trigger?: string;
  readonly statusBefore?: string;
  readonly statusAfter?: string;
  readonly settlement?: string | null;
  readonly incident?: string;
  readonly errorKind?: string;
  readonly errorCode?: string | null;
  readonly httpStatus?: number | null;
  readonly eventId?: string | null;
  readonly eventType?: string;
  readonly reason?: string;
  readonly count?: number;
}

export type PaymentLogEvent =
  | "payment.attempt_created"
  | "payment.attempt_start_failed"
  | "payment.sync"
  | "payment.settled"
  | "payment.incident_open"
  | "payment.provider_error"
  | "payment.webhook_received"
  | "payment.webhook_auth_failed"
  | "payment.webhook_ignored"
  | "payment.webhook_processed"
  | "payment.webhook_verification_received"
  | "payment.needs_sandbox_verification"
  | "payment.reconcile";

export interface PaymentLogger {
  info(event: PaymentLogEvent, fields?: PaymentLogFields): void;
  warn(event: PaymentLogEvent, fields?: PaymentLogFields): void;
  error(event: PaymentLogEvent, fields?: PaymentLogFields): void;
}
