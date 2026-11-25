import "server-only";
import { findLatestAttemptForOrder } from "@masar/db";
import { syncAttempt } from "@masar/payments";
import { logCheckoutFailure } from "../checkout/failure";
import { getPayments } from "./runtime";

/**
 * التحقق الخادمي من دفع طلب عند عودة العميل: يقرأ أحدث محاولة للطلب من المزوّد بالمفتاح السري
 * (`syncAttempt`). لا يأخذ شيئًا من رابط العودة، ولا يرمي: أي عطل يُسجَّل والصفحة تعرض الحالة
 * المحفوظة («نتحقق من دفعتك»)، والمطابقة الدورية تحسمها.
 */
export async function verifyOrderPayment(orderId: string): Promise<void> {
  const payments = getPayments();
  if (payments === null) {
    return;
  }
  try {
    const attempt = await findLatestAttemptForOrder(payments.deps.db, orderId);
    if (attempt !== undefined) {
      await syncAttempt(payments.deps, attempt.id, "return");
    }
  } catch (error) {
    logCheckoutFailure("payment.return_verify_failed", error);
  }
}
