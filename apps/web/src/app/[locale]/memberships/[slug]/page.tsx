import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { INTRO_ID, PageIntro } from "@/components/page-intro";
import { PageShell } from "@/components/page-shell";
import { toPlanViews } from "@/components/plans/plan-view";
import { PlansSection } from "@/components/plans/plans-section";
import { Benefits, Payment, Visit } from "@/components/sections/closing";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale, localizedPath } from "@/i18n/locales";
import { getMembershipPlan, getMembershipPlans } from "@/server/catalog";
import { isCheckoutEnabled } from "@/server/checkout/flag";
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
  const [plans, plan] = await Promise.all([getMembershipPlans(), getMembershipPlan(slug)]);
  if (plan === undefined) {
    notFound();
  }
  const dictionary = getDictionary(locale);
  const back = <Link href={localizedPath(locale, "/memberships")}>{dictionary.plan.back}</Link>;

  return (
    <PageShell locale={locale} path={`/memberships/${plan.slug}`} hasPlans>
      <PageIntro title={plan.name[locale]} lead={plan.summary[locale]} before={back} />
      <PlansSection
        plans={toPlanViews(plans, locale, isCheckoutEnabled())}
        locale={locale}
        dictionary={dictionary}
        currentSlug={plan.slug}
        revealAfterId={INTRO_ID}
        showCompare
      />
      <Benefits
        title={dictionary.plan.includesTitle}
        benefits={plan.benefits.map((benefit) => benefit[locale])}
      />
      <Payment dictionary={dictionary} />
      <Visit locale={locale} dictionary={dictionary} />
    </PageShell>
  );
}
