import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckoutSteps } from "@/components/checkout/checkout-steps";
import { OrderReview } from "@/components/checkout/order-review";
import { PaymentPanel } from "@/components/checkout/payment-panel";
import { toPaymentPanelView, withPaymentHeadline } from "@/components/checkout/payment-view";
import { toReviewView } from "@/components/checkout/review-view";
import { PageIntro } from "@/components/page-intro";
import { PageShell } from "@/components/page-shell";
import { PAY_NOTICE_PARAM, orderPath, parsePayNotice } from "@/config/payments";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/locales";
import { isCheckoutPreview, requireCheckout } from "@/server/checkout/flag";
import { checkoutMetadata } from "@/server/checkout/metadata";
import { getOrderView } from "@/server/checkout/order-view";
import { getPaymentPanelState } from "@/server/payments/panel";

type Props = PageProps<"/[locale]/checkout/orders/[token]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  requireCheckout();
  const { locale } = await params;
  return isLocale(locale) ? checkoutMetadata(getDictionary(locale).checkout.meta.orderTitle) : {};
}

/**
 * مراجعة الطلب برمزه العام (خلف العلم): من اللقطة المختومة فقط، والجوال مقنَّع. رمز غير معروف ⇒ 404.
 * بلا مزوّد دفع مضبوط: لا زر دفع، والخطوة التالية واتساب برقم الطلب كما كانت.
 * مع مزوّد مضبوط: قسم الدفع بحالته المحفوظة. الصفحة لا تفعّل شيئًا ولا تقرأ من المزوّد: التحقق في
 * صفحة العودة والإشعار والمطابقة.
 */
export default async function OrderPage({ params, searchParams }: Props) {
  requireCheckout();
  const { locale, token } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const order = await getOrderView(token);
  if (order === undefined) {
    notFound();
  }
  const review = toReviewView(order, locale);
  const payment = await getPaymentPanelState(order);
  const notice = parsePayNotice((await searchParams)[PAY_NOTICE_PARAM]);
  const view = payment === null ? review : withPaymentHeadline(review, payment.state, locale);
  const dictionary = getDictionary(locale);
  const panel =
    payment === null ? null : toPaymentPanelView(order, { ...payment, notice }, locale, token);
  return (
    <PageShell locale={locale} path={orderPath(token)} mobileAction={null}>
      <PageIntro title={view.title} lead={view.lead}>
        <CheckoutSteps current="payment" labels={dictionary.steps} />
      </PageIntro>
      <OrderReview
        view={view}
        labels={dictionary.checkout}
        payment={panel === null ? null : <PaymentPanel view={panel} />}
        preview={isCheckoutPreview()}
      />
    </PageShell>
  );
}
