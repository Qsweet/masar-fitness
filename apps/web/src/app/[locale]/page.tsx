import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Facilities } from "@/components/home/facilities";
import { Hero } from "@/components/home/hero";
import { Location } from "@/components/home/location";
import { PlansSection } from "@/components/home/plans-section";
import { Steps } from "@/components/home/steps";
import { PageShell } from "@/components/page-shell";
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
  const plans = await getMembershipPlans();

  return (
    <PageShell locale={locale} path={PATH}>
      <Hero locale={locale} dictionary={dictionary} />
      <PlansSection plans={plans} locale={locale} dictionary={dictionary} />
      <Facilities dictionary={dictionary} />
      <Steps dictionary={dictionary} />
      <Location locale={locale} dictionary={dictionary} />
    </PageShell>
  );
}
