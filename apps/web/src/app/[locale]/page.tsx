import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Facilities } from "@/components/home/facilities";
import { Location } from "@/components/home/location";
import { Steps } from "@/components/home/steps";
import { PageIntro } from "@/components/page-intro";
import { PageShell } from "@/components/page-shell";
import { PlanShop } from "@/components/plans/plan-shop";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale, localizedPath } from "@/i18n/locales";
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
    <PageShell locale={locale} path={PATH} stickyBar={plans.length > 0}>
      <PageIntro title={dictionary.hero.title} lead={dictionary.hero.lead} />
      <section
        id="plans"
        aria-labelledby="plans-title"
        className="surface-light scroll-mt-4 py-8 md:py-14"
      >
        <div className="page-container">
          {/* على الجوال القائمة تشرح نفسها، والمساحة للباقات الأربع فوق شريط الشراء */}
          <h2 id="plans-title" className="sr-only mb-5 text-title font-display md:not-sr-only">
            {dictionary.plans.title}
          </h2>
          <PlanShop plans={plans} locale={locale} dictionary={dictionary} />
          {plans.length > 1 ? (
            <p className="mt-8">
              <Link
                href={`${localizedPath(locale, "/memberships")}#compare`}
                className="font-strong underline underline-offset-4"
              >
                {dictionary.plans.compare}
              </Link>
            </p>
          ) : null}
        </div>
      </section>
      <Facilities dictionary={dictionary} />
      <Steps dictionary={dictionary} />
      <Location locale={locale} dictionary={dictionary} />
    </PageShell>
  );
}
