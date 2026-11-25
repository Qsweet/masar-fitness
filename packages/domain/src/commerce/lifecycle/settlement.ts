import { DomainError } from "../../errors";
import type { Money } from "../../money";
import { err, ok, type Result } from "../../result";
import type { OrderStatus } from "./order-state";

/** دفعة متحقق منها خادميًا لدى المزوّد، بقيمها الخام. نقطة تسليم المرحلة 4. */
export interface VerifiedPayment {
  readonly provider: string;
  readonly providerPaymentId: string;
  readonly amountMinor: number;
  readonly currency: string;
}

export interface PaymentReference {
  readonly provider: string;
  readonly providerPaymentId: string;
}

export interface SettleableOrder {
  readonly status: OrderStatus;
  readonly total: Money;
  /** الدفعة المسجّلة على الطلب، أو null إن لم يُدفع. */
  readonly paid: PaymentReference | null;
}

/** `apply`: سجّل الدفعة الآن. `replay`: الدفعة نفسها مسجّلة، فلا كتابة. */
export type SettlementDecision = "apply" | "replay";

const PROVIDER_PATTERN = /^[a-z][a-z0-9_]{1,31}$/;
const MAX_PAYMENT_ID_LENGTH = 200;

function isValidReference(payment: PaymentReference): boolean {
  // الطول بالمحارف كما يحسبه `char_length` في PostgreSQL
  const idLength = Array.from(payment.providerPaymentId).length;
  return (
    PROVIDER_PATTERN.test(payment.provider) && idLength >= 1 && idLength <= MAX_PAYMENT_ID_LENGTH
  );
}

function sameReference(a: PaymentReference, b: PaymentReference): boolean {
  return a.provider === b.provider && a.providerPaymentId === b.providerPaymentId;
}

/**
 * يقرر تسجيل دفعة على طلب. لا انتقال `expired → paid`: الطلب المنتهي أو الملغى لا يُدفع.
 * المقارنة بالأعداد الصحيحة كما وصلت؛ أي مبلغ لا يساوي الإجمالي بالهللة مرفوض.
 */
export function decideSettlement(
  order: SettleableOrder,
  payment: VerifiedPayment,
): Result<SettlementDecision, DomainError> {
  if (!isValidReference(payment)) {
    return err(new DomainError("validation", "payment.invalid_reference"));
  }
  if (order.paid !== null) {
    return sameReference(order.paid, payment)
      ? ok("replay")
      : err(new DomainError("conflict", "order.already_paid"));
  }
  if (order.status !== "pending_payment") {
    return err(new DomainError("conflict", "order.not_payable"));
  }
  if (payment.currency !== order.total.currency) {
    return err(new DomainError("conflict", "payment.currency_mismatch"));
  }
  if (payment.amountMinor !== order.total.amountMinor) {
    return err(new DomainError("conflict", "payment.amount_mismatch"));
  }
  return ok("apply");
}
