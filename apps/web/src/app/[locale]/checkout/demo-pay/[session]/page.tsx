import { money } from "@masar/domain";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DemoPay } from "@/components/checkout/demo-pay";
import { PageIntro } from "@/components/page-intro";
import { PageShell } from "@/components/page-shell";
import { demoPayPath } from "@/config/payments";
import { defaultDictionary } from "@/i18n/dictionaries";
import { moneyParts } from "@/i18n/format";
import { isLocale } from "@/i18n/locales";
import { requireCheckout } from "@/server/checkout/flag";
import { checkoutMetadata } from "@/server/checkout/metadata";
import { requireDemoPayments } from "@/server/payments/demo-guard";

type Props = PageProps<"/[locale]/checkout/demo-pay/[session]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  requireCheckout();
  const { locale } = await params;
  return isLocale(locale)
    ? checkoutMetadata(defaultDictionary(locale).onlinePayment.demo.metaTitle)
    : {};
}

/**
 * صفحة الدفع التجريبية: تقوم مقام صفحة المزوّد المستضافة حين يكون المزوّد المضبوط مزوّد الاختبار
 * (يفرضه parse-env)، والطلب نفسه على عنوان الجهاز. غير ذلك ⇒ 404. لا مال ولا بطاقة.
 */
export default async function DemoPayPage({ params }: Props) {
  requireCheckout();
  const { locale, session: sessionId } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const { payments, store } = await requireDemoPayments();
  const session = store.get(sessionId);
  if (session === undefined) {
    notFound();
  }
  const { request } = session;
  const labels = defaultDictionary(locale).onlinePayment.demo;
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
