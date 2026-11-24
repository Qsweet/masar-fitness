import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Steps } from "@/components/home/steps";
import { PageIntro } from "@/components/page-intro";
import { PageShell } from "@/components/page-shell";
import { PlanShop } from "@/components/plans/plan-shop";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale, localizedPath } from "@/i18n/locales";
import { getMembershipPlan, getMembershipPlans } from "@/server/catalog";
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
  const plans = await getMembershipPlans();
  const plan = plans.find((candidate) => candidate.slug === slug);
  if (plan === undefined) {
    notFound();
  }
  const dictionary = getDictionary(locale);
  const back = (
    <p className="mb-4">
      <Link
        href={localizedPath(locale, "/memberships")}
        className="font-medium underline underline-offset-4"
      >
        {dictionary.plan.back}
      </Link>
    </p>
  );

  return (
    <PageShell locale={locale} path={`/memberships/${plan.slug}`} stickyBar>
      <PageIntro title={plan.name[locale]} lead={plan.summary[locale]} before={back} />
      <section className="surface-light py-4 md:py-14">
        <div className="page-container">
          <PlanShop plans={plans} selected={plan} locale={locale} dictionary={dictionary} />
        </div>
      </section>
      <section
        aria-labelledby="includes-title"
        className="surface-light surface-light-raised rule border-y py-12 md:py-16"
      >
        <div className="page-container">
          <h2 id="includes-title" className="text-title font-display">
            {dictionary.plan.includesTitle}
          </h2>
          <ul className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
            {plan.benefits.map((benefit) => (
              <li key={benefit.ar} className="rule border-t pt-4 text-heading font-strong">
                {benefit[locale]}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <Steps dictionary={dictionary} />
    </PageShell>
  );
}
