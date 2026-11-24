import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageIntro } from "@/components/page-intro";
import { PageShell } from "@/components/page-shell";
import { ComparisonTable } from "@/components/plans/comparison-table";
import { PlanShop } from "@/components/plans/plan-shop";
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
    <PageShell locale={locale} path={PATH} stickyBar={plans.length > 0}>
      <PageIntro title={dictionary.memberships.title} lead={dictionary.memberships.intro} />
      <section className="surface-light py-4 md:py-14">
        <div className="page-container">
          <PlanShop plans={plans} locale={locale} dictionary={dictionary} />
        </div>
      </section>
      {plans.length > 1 ? (
        <section
          id="compare"
          aria-labelledby="compare-title"
          className="surface-light surface-light-raised rule scroll-mt-4 border-t py-14 md:py-20"
        >
          <div className="page-container">
            <h2 id="compare-title" className="text-title font-display">
              {dictionary.memberships.compareTitle}
            </h2>
            <p className="text-muted mt-3 mb-8 max-w-prose">{dictionary.memberships.lead}</p>
            <ComparisonTable plans={plans} locale={locale} dictionary={dictionary} />
          </div>
        </section>
      ) : null}
    </PageShell>
  );
}
