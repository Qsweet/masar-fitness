import "server-only";
import { FAKE_PROVIDER_ID, type FakeProviderStore } from "@masar/payments";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { isLoopbackHost } from "@/config/payments";
import { getPayments, type PaymentRuntime } from "./runtime";

export interface DemoPayments {
  readonly payments: PaymentRuntime;
  readonly store: FakeProviderStore;
}

/**
 * حارس صفحة الدفع التجريبية وإجرائها: 404 ما لم يكن المزوّد المضبوط مزوّد الاختبار **والطلب نفسه
 * واصلًا على عنوان الجهاز** (ترويسة Host). سدّ ثانٍ فوق فحص الإقلاع: نشر خلف وسيط باسم عام لا يعرض
 * المحاكاة ولو ضُبطت خطأً.
 */
export async function requireDemoPayments(): Promise<DemoPayments> {
  const payments = getPayments();
  const host = (await headers()).get("host");
  if (
    payments?.deps.provider.id !== FAKE_PROVIDER_ID ||
    payments.fakeStore === null ||
    !isLoopbackHost(host)
  ) {
    notFound();
  }
  return { payments, store: payments.fakeStore };
}
