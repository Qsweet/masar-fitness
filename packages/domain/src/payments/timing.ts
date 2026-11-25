import { DomainError } from "../errors";
import { err, ok, type Result } from "../result";

/**
 * هامش بين نهاية جلسة المزوّد ومهلة الطلب (الشرط الصلب 1): يغطي فرق الساعات بين خادمنا والمزوّد
 * وزمن الشبكة. القيمة مقترحة في PHASE4_PAYMENTS_DESIGN §5.6 (لا انحراف ساعة موثق عند المزوّد).
 */
export const PROVIDER_SESSION_MARGIN_MINUTES = 5;

const MS_PER_MINUTE = 60_000;

export interface PaymentDeadlineInput {
  readonly now: Date;
  readonly orderExpiresAt: Date;
  /** أقل وقت معقول لإكمال الدفع. لا قيمة له في الكود: يُقاس في التجربة (WP0) ويأتي من الإعداد. */
  readonly minPaymentMinutes: number;
}

/**
 * آخر لحظة يكمل فيها العميل الدفع: `expires_at − الهامش`. يرفض البدء إن لم يبقَ وقت يكفي للدفع
 * (`now + minPayment + margin > expires_at`)، فلا تُفتح جلسة لا يمكن إكمالها.
 */
export function paymentDeadline(input: PaymentDeadlineInput): Result<Date, DomainError> {
  const { now, orderExpiresAt, minPaymentMinutes } = input;
  if (!Number.isSafeInteger(minPaymentMinutes) || minPaymentMinutes <= 0) {
    throw new DomainError("invariant", "payment.invalid_min_payment_time");
  }
  const deadline = orderExpiresAt.getTime() - PROVIDER_SESSION_MARGIN_MINUTES * MS_PER_MINUTE;
  if (now.getTime() + minPaymentMinutes * MS_PER_MINUTE > deadline) {
    return err(new DomainError("conflict", "payment.window_too_short"));
  }
  return ok(new Date(deadline));
}
