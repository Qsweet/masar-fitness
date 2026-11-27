import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { orderPath } from "@/config/payments";
import { defaultDictionary } from "@/i18n/dictionaries";
import { isLocale, localizedPath } from "@/i18n/locales";
import { requireCheckout } from "@/server/checkout/flag";
import { checkoutMetadata } from "@/server/checkout/metadata";
import { getOrderView } from "@/server/checkout/order-view";
import { requestIp } from "@/server/checkout/throttle";
import { allowPaymentCheck } from "@/server/payments/throttle";
import { verifyOrderPayment } from "@/server/payments/verify";

type Props = PageProps<"/[locale]/checkout/orders/[token]/return">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  requireCheckout();
  const { locale } = await params;
  return isLocale(locale)
    ? checkoutMetadata(defaultDictionary(locale).checkout.meta.orderTitle)
    : {};
}

/**
 * صفحة العودة من مزوّد الدفع (`success_url` و`back_url`). **لا تفعّل شيئًا من الرابط**: ما يلحقه
 * المزوّد به (المعرّف والحالة والرسالة) لا يُقرأ أصلًا. تُحدَّد المحاولة من رمز الطلب، وتُقرأ حالتها من
 * المزوّد بالمفتاح السري، ثم يُحوَّل العميل إلى صفحة طلبه لتعرض حالته الفعلية أو «نتحقق من دفعتك».
 */
export default async function PaymentReturnPage({ params }: Props) {
  requireCheckout();
  const { locale, token } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const order = await getOrderView(token);
  if (order === undefined) {
    notFound();
  }
  if (allowPaymentCheck(await requestIp())) {
    await verifyOrderPayment(order.id);
  }
  redirect(localizedPath(locale, orderPath(token)));
}
