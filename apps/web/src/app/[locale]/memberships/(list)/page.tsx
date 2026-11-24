import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { ComparisonTable } from "@/components/plans/comparison-table";
import { PlanLanes } from "@/components/plans/plan-lanes";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/locales";
import { getMembershipPlans } from "@/server/catalog";
import { pageMetadata } from "@/server/metadata";

const PATH = "/memberships";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/memberships">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) {
    return {};
  }
  const { meta } = getDictionary(locale);
  return pageMetadata({
    locale,
    path: PATH,
    title: meta.membershipsTitle,
    description: meta.membershipsDescription,
  });
}

export default async function MembershipsPage({ params }: PageProps<"/[locale]/memberships">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const dictionary = getDictionary(locale);
  const plans = await getMembershipPlans();

  return (
    <PageShell locale={locale} path={PATH}>
      <section className="surface-asphalt pt-14 pb-20 md:pt-20 md:pb-28">
        <div className="page-container">
          <h1 className="text-title font-display">{dictionary.memberships.title}</h1>
          <p className="text-muted mt-4 mb-10 max-w-prose text-lead">{dictionary.plans.lead}</p>
          <PlanLanes plans={plans} locale={locale} dictionary={dictionary} />
        </div>
      </section>
      {plans.length > 1 ? (
        <section
          id="compare"
          aria-labelledby="compare-title"
          className="surface-chalk surface-chalk-raised scroll-mt-4 py-20 md:py-28"
        >
          <div className="page-container">
            <h2 id="compare-title" className="text-title font-display">
              {dictionary.memberships.compareTitle}
            </h2>
            <p className="text-muted mt-4 mb-10 max-w-prose">{dictionary.memberships.lead}</p>
            <ComparisonTable plans={plans} locale={locale} dictionary={dictionary} />
          </div>
        </section>
      ) : null}
    </PageShell>
  );
}
