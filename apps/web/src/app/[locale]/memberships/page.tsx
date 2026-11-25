import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { INTRO_ID, PageIntro } from "@/components/page-intro";
import { PageShell } from "@/components/page-shell";
import { ComparisonTable } from "@/components/plans/comparison-table";
import { toPlanViews } from "@/components/plans/plan-view";
import { PlansSection } from "@/components/plans/plans-section";
import { Payment } from "@/components/sections/closing";
import { ButtonLink } from "@/components/ui/button-link";
import { ROUTES } from "@/config/routes";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale, localizedPath } from "@/i18n/locales";
import { getMembershipPlans } from "@/server/catalog";
import { pageMetadata } from "@/server/metadata";
import styles from "./memberships.module.css";

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
    <PageShell locale={locale} path={PATH} hasPlans={plans.length > 0}>
      <PageIntro title={dictionary.memberships.title} lead={dictionary.memberships.intro} />
      <PlansSection
        plans={toPlanViews(plans, locale)}
        locale={locale}
        dictionary={dictionary}
        revealAfterId={INTRO_ID}
      />
      {plans.length > 1 ? (
        <section id="compare" aria-labelledby="compare-title" className="container section">
          <h2 id="compare-title" className="title-section">
            {dictionary.memberships.compareTitle}
          </h2>
          <ComparisonTable plans={plans} locale={locale} dictionary={dictionary} />
          <p className={styles.toolLink}>
            <ButtonLink href={localizedPath(locale, ROUTES.costPerVisit)} variant="line">
              {dictionary.tools.costPerVisit.membershipsLink}
            </ButtonLink>
          </p>
        </section>
      ) : null}
      <Payment dictionary={dictionary} />
    </PageShell>
  );
}
