/**
 * تحويل حالات Moyasar الخام إلى الحالات المحايدة. جدول شامل لكل حالة موثقة؛ ما لم يُتحقق من معناه
 * في البيئة التجريبية يصير `indeterminate` فلا تُنهى به المحاولة ولا تُسوّى، وتبقى حيّة حتى تُحسم
 * (وتنبّه حادثة `stuck_pending` بعد موعدها). لا تخمين.
 */
import type { ProviderPaymentState, ProviderSessionState } from "@masar/domain";
import type { MoyasarInvoiceStatus, MoyasarPayment, MoyasarPaymentStatus } from "./parse";

/**
 * - `initiated`: الفاتورة تقبل الدفع.
 * - `expired`: «An expired invoice cannot have payment attempts»، و`canceled`: «can no longer be paid»
 *   (docs.moyasar.com/docs/guides/invoices/creating-invoices.md و docs.moyasar.com/api/invoices/06-cancel-invoice).
 * - `paid`: الحسم بدفعات الفاتورة نفسها، لا بحالتها.
 * - `failed` و`refunded` و`on_hold` و`voided`: موثقة أسماؤها بلا تعريف لقبول دفع جديد: تُحسم في WP0.
 */
const SESSION_STATES: Readonly<Record<MoyasarInvoiceStatus, ProviderSessionState>> = {
  initiated: "open",
  expired: "closed",
  canceled: "closed",
  paid: "indeterminate",
  failed: "indeterminate",
  refunded: "indeterminate",
  on_hold: "indeterminate",
  voided: "indeterminate",
};

/**
 * docs.moyasar.com/docs/api/payments/payment-status-reference.md
 * - `captured` تحصيل دفعة `authorized` (`manual: true`، ولا نستعمله) وقد يكون جزئيًا: لا يُعامل مدفوعًا.
 * - `verified` (ترميز بطاقة) و`expired` (فاتورة SADAD) لا مكان لهما في فاتورة مستضافة.
 */
const PAYMENT_STATES: Readonly<Record<MoyasarPaymentStatus, ProviderPaymentState>> = {
  initiated: "in_progress",
  paid: "paid",
  authorized: "authorized",
  failed: "failed",
  refunded: "refunded",
  voided: "voided",
  captured: "indeterminate",
  verified: "indeterminate",
  expired: "indeterminate",
};

export function sessionStateOf(status: MoyasarInvoiceStatus): ProviderSessionState {
  return SESSION_STATES[status];
}

/** دفعة `paid` استُرد منها شيء (`refunded > 0`) ليست مالًا كاملًا عندنا: تُعامل مستردة. */
export function paymentStateOf(payment: MoyasarPayment): ProviderPaymentState {
  if (payment.status === "paid" && payment.refunded > 0) {
    return "refunded";
  }
  return PAYMENT_STATES[payment.status];
}
