import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderReview } from "@/components/checkout/order-review";
import { toReviewView } from "@/components/checkout/review-view";
import { PageIntro } from "@/components/page-intro";
import { PageShell } from "@/components/page-shell";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/locales";
import { requireCheckout } from "@/server/checkout/flag";
import { checkoutMetadata } from "@/server/checkout/metadata";
import { getOrderView } from "@/server/checkout/order-view";

type Props = PageProps<"/[locale]/checkout/orders/[token]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  requireCheckout();
  const { locale } = await params;
  return isLocale(locale) ? checkoutMetadata(getDictionary(locale).checkout.meta.orderTitle) : {};
}

/**
 * مراجعة الطلب برمزه العام (خلف العلم): من اللقطة المختومة فقط، والجوال مقنَّع.
 * لا زر دفع: الدفع الإلكتروني غير متاح بعد، والخطوة التالية واتساب برقم الطلب. رمز غير معروف ⇒ 404.
 */
export default async function OrderPage({ params }: Props) {
  requireCheckout();
  const { locale, token } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const order = await getOrderView(token);
  if (order === undefined) {
    notFound();
  }
  const view = toReviewView(order, locale);
  return (
    <PageShell locale={locale} path={`/checkout/orders/${token}`}>
      <PageIntro title={view.title} lead={view.lead} />
      <OrderReview view={view} labels={getDictionary(locale).checkout} />
    </PageShell>
  );
}
