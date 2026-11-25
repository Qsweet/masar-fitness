import "server-only";
import { getOrderPaymentSummary, type OrderView } from "@masar/db";
import { paymentDeadline, paymentDisplayState, type PaymentDisplayState } from "@masar/domain";
import { FAKE_PROVIDER_ID } from "@masar/payments";
import { getDb } from "../db";
import { guardCheckout } from "../checkout/failure";
import { getPayments } from "./runtime";

export interface PaymentPanelState {
  readonly state: PaymentDisplayState;
  /** آخر محاولة انتهت بلا مال: يُنبَّه العميل قبل إعادة المحاولة. */
  readonly retrying: boolean;
  /** المزوّد المضبوط محاكاة (وضع العرض التجريبي): تُعرض لافتته. */
  readonly demo: boolean;
}

/**
 * حالة قسم الدفع لطلب، أو null إن لم يُضبط مزوّد (فتُعرض الصفحة كما كانت قبل المرحلة 4).
 * تُقرأ من القاعدة فقط: التحقق من المزوّد في صفحة العودة والإشعار والمطابقة، لا هنا.
 */
export async function getPaymentPanelState(order: OrderView): Promise<PaymentPanelState | null> {
  const payments = getPayments();
  if (payments === null) {
    return null;
  }
  const summary = await guardCheckout("payment.summary_read_failed", () =>
    getOrderPaymentSummary(getDb(), order.id),
  );
  const now = payments.deps.clock();
  const canStart = paymentDeadline({
    now,
    orderExpiresAt: order.expiresAt,
    minPaymentMinutes: payments.deps.minPaymentMinutes,
  }).ok;
  const state = paymentDisplayState({
    orderStatus: order.status,
    orderExpiresAt: order.expiresAt,
    now,
    liveAttempt: summary.liveAttempt,
    hasOpenIncident: summary.hasOpenIncident,
    canStart,
  });
  return {
    state,
    retrying: summary.lastAttemptFailed,
    demo: payments.deps.provider.id === FAKE_PROVIDER_ID,
  };
}
