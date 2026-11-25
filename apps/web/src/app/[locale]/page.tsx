import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { toPlanViews } from "@/components/plans/plan-view";
import { PlansSection } from "@/components/plans/plans-section";
import { Final, Payment, Visit } from "@/components/sections/closing";
import { FacilityLine, Hero, HERO_ID, Train, Trust, Water } from "@/components/sections/story";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/locales";
import { getMembershipPlans } from "@/server/catalog";
import { pageMetadata } from "@/server/metadata";

const PATH = "/";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) {
    return {};
  }
  const { meta, club } = getDictionary(locale);
  return {
    ...pageMetadata({
      locale,
      path: PATH,
      title: meta.homeTitle,
      description: meta.homeDescription,
    }),
    title: { absolute: `${club.name} | ${meta.homeTitle}` },
  };
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const dictionary = getDictionary(locale);
  const plans = toPlanViews(await getMembershipPlans(), locale);

  return (
    <PageShell locale={locale} path={PATH} hasPlans>
      <Hero dictionary={dictionary} />
      <FacilityLine dictionary={dictionary} />
      <PlansSection
        plans={plans}
        locale={locale}
        dictionary={dictionary}
        revealAfterId={HERO_ID}
        showCompare
      />
      <Train dictionary={dictionary} />
      <Water dictionary={dictionary} />
      <Payment dictionary={dictionary} />
      <Trust dictionary={dictionary} />
      <Visit locale={locale} dictionary={dictionary} />
      <Final dictionary={dictionary} />
    </PageShell>
  );
}
