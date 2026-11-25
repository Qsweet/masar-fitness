import { FAKE_PROVIDER_ID } from "@masar/payments";
import { money } from "@masar/domain";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DemoPay } from "@/components/checkout/demo-pay";
import { PageIntro } from "@/components/page-intro";
import { PageShell } from "@/components/page-shell";
import { demoPayPath } from "@/config/payments";
import { getDictionary } from "@/i18n/dictionaries";
import { moneyParts } from "@/i18n/format";
import { isLocale } from "@/i18n/locales";
import { requireCheckout } from "@/server/checkout/flag";
import { checkoutMetadata } from "@/server/checkout/metadata";
import { getPayments } from "@/server/payments/runtime";

type Props = PageProps<"/[locale]/checkout/demo-pay/[session]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  requireCheckout();
  const { locale } = await params;
  return isLocale(locale)
    ? checkoutMetadata(getDictionary(locale).onlinePayment.demo.metaTitle)
    : {};
}

/**
 * صفحة الدفع التجريبية: تقوم مقام صفحة المزوّد المستضافة حين يكون المزوّد المضبوط مزوّد الاختبار
 * (عنوان الجهاز نفسه فقط، يفرضه parse-env). مع أي مزوّد آخر أو بلا مزوّد ⇒ 404. لا مال ولا بطاقة.
 */
export default async function DemoPayPage({ params }: Props) {
  requireCheckout();
  const { locale, session: sessionId } = await params;
  const payments = getPayments();
  if (!isLocale(locale) || payments?.deps.provider.id !== FAKE_PROVIDER_ID) {
    notFound();
  }
  const session = payments.fakeStore?.get(sessionId);
  if (session === undefined) {
    notFound();
  }
  const { request } = session;
  const labels = getDictionary(locale).onlinePayment.demo;
  const open = session.state === "open" && payments.deps.clock() < request.expiresAt;
  return (
    <PageShell locale={locale} path={demoPayPath(sessionId)}>
      <PageIntro title={labels.title} lead={labels.lead} />
      <DemoPay
        labels={labels}
        view={{
          sessionId,
          reference: request.orderReference,
          amount: moneyParts(money(request.amountMinor, request.currency), locale),
          open,
          backHref: request.backUrl,
        }}
      />
    </PageShell>
  );
}
