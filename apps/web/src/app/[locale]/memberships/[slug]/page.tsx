import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Steps } from "@/components/home/steps";
import { PageShell } from "@/components/page-shell";
import { PlanSummary } from "@/components/plans/plan-summary";
import { PurchasePanel, StickyPurchaseBar } from "@/components/plans/purchase-panel";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/locales";
import { getMembershipPlan } from "@/server/catalog";
import { pageMetadata } from "@/server/metadata";

type Props = PageProps<"/[locale]/memberships/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const plan = isLocale(locale) ? await getMembershipPlan(slug) : undefined;
  if (!isLocale(locale) || plan === undefined) {
    return {};
  }
  return pageMetadata({
    locale,
    path: `/memberships/${plan.slug}`,
    title: plan.name[locale],
    description: getDictionary(locale).meta.planDescription,
  });
}

export default async function PlanPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const plan = await getMembershipPlan(slug);
  if (plan === undefined) {
    notFound();
  }
  const dictionary = getDictionary(locale);

  return (
    <PageShell locale={locale} path={`/memberships/${plan.slug}`}>
      <PlanSummary plan={plan} locale={locale} dictionary={dictionary} />
      <section className="surface-chalk py-16 md:py-24">
        <div className="page-container grid gap-10 md:grid-cols-12">
          <div className="md:col-span-6">
            <h2 className="text-title font-display">{dictionary.plan.includesTitle}</h2>
            <ul className="rule mt-8 border-b">
              {plan.benefits.map((benefit) => (
                <li key={benefit.ar} className="rule border-t py-4 text-heading font-strong">
                  {benefit[locale]}
                </li>
              ))}
            </ul>
          </div>
          <div className="md:col-span-5 md:col-start-8">
            <PurchasePanel plan={plan} locale={locale} dictionary={dictionary} />
          </div>
        </div>
      </section>
      <Steps dictionary={dictionary} />
      {/* مساحة بارتفاع شريط الشراء الثابت حتى لا يغطي آخر التذييل على الجوال */}
      <div className="surface-asphalt surface-asphalt-deep h-20 md:hidden" aria-hidden="true" />
      <StickyPurchaseBar plan={plan} locale={locale} dictionary={dictionary} />
    </PageShell>
  );
}
