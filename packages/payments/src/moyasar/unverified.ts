/**
 * ما لا يُحسم من وثائق Moyasar ولا يُخمَّن: يرجع خطأً صريحًا `needs_sandbox_verification` حتى تُجرى
 * تجربة البيئة التجريبية (WP0 في PHASE4_PAYMENTS_DESIGN §7) ويُكتب الكود من نتائجها المسجّلة.
 * القائمة الكاملة لما ينتظر WP0 (ومنه ما عولج هنا بالاتجاه الآمن بلا خطأ) في docs/PAYMENTS.md.
 */
import { ProviderError } from "../port";

export const MOYASAR_SANDBOX_SEAMS = {
  /**
   * البحث عن فاتورة يتيمة بـ`metadata[attempt_id]` في List Invoices: التصفية موثقة
   * (docs.moyasar.com/docs/api/metadata.md) لكن شكل رد القائمة وترقيم صفحاتها لم يُتحقق منهما.
   */
  listInvoicesByMetadata: "moyasar.list_invoices_by_metadata",
} as const;

export type MoyasarSandboxSeam = (typeof MOYASAR_SANDBOX_SEAMS)[keyof typeof MOYASAR_SANDBOX_SEAMS];

export function needsSandboxVerification(seam: MoyasarSandboxSeam): ProviderError {
  return new ProviderError("needs_sandbox_verification", { code: seam });
}
