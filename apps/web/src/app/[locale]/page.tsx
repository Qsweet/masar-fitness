import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import { About } from "@/components/home/about";
import { Contact } from "@/components/home/contact";
import { CtaBand } from "@/components/home/cta-band";
import { Facilities } from "@/components/home/facilities";
import { Goals } from "@/components/home/goals";
import { Hero, HERO_ACTIONS_ID } from "@/components/home/hero/hero";
import { Highlights } from "@/components/home/highlights";
import { offerView, ratingView } from "@/components/home/home-view";
import { Hours } from "@/components/home/hours";
import { Reviews } from "@/components/home/reviews";
import { Services } from "@/components/home/services";
import { HomeSlider } from "@/components/home/slider/home-slider";
import { friendsView, serviceViews } from "@/components/home/services-view";
import { Stats } from "@/components/home/stats";
import { Team } from "@/components/home/team";
import { PageShell } from "@/components/page-shell";
import { FriendsOffer } from "@/components/plans/friends-offer";
import { toPlanViews } from "@/components/plans/plan-view";
import { PlansSection } from "@/components/plans/plans-section";
import { isLocale } from "@/i18n/locales";
import { getMembershipPlans } from "@/server/catalog";
import { isCheckoutEnabled } from "@/server/checkout/flag";
import { getSiteContent } from "@/server/content/site-content";
import { pageMetadata } from "@/server/metadata";
import { clubPhotoUrls, siteIdentity } from "@/server/site-identity";
import { homeGraph } from "@/server/structured-data";

const PATH = "/";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) {
    return {};
  }
  const { meta, club } = (await getSiteContent(locale)).dictionary;
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

/**
 * الرئيسية بترتيب تصميم المالك (القرار 57) وبمحتوى النادي الحقيقي: الواجهة بالفيديو، ثم شريط الشرائح
 * من اللوحة إن سرت شريحة (ADMIN_A3_SLIDER §10)، المزايا الخمس،
 * الأهداف، المرافق، الأرقام، الاشتراكات وعرض الأصدقاء، من نحن، البرامج، الفريق، الآراء، الأوقات،
 * الدعوة، التواصل.
 */
export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const { dictionary, slider } = await getSiteContent(locale);
  const plans = toPlanViews(await getMembershipPlans(), locale, isCheckoutEnabled());
  const offer = offerView(plans, dictionary);
  const rating = ratingView(dictionary, locale);

  return (
    <PageShell locale={locale} path={PATH} hasPlans={plans.length > 0}>
      <Hero dictionary={dictionary} />
      <HomeSlider slider={slider} locale={locale} dictionary={dictionary} now={new Date()} />
      <Highlights dictionary={dictionary} />
      <Goals dictionary={dictionary} />
      <Facilities dictionary={dictionary} />
      <Stats locale={locale} dictionary={dictionary} rating={rating} />
      <PlansSection
        plans={plans}
        locale={locale}
        dictionary={dictionary}
        revealAfterId={HERO_ACTIONS_ID}
        showCompare
      >
        <FriendsOffer dictionary={dictionary} view={friendsView(dictionary, locale)} />
      </PlansSection>
      <About dictionary={dictionary} />
      <Services dictionary={dictionary} services={serviceViews(dictionary, locale)} />
      <Team dictionary={dictionary} />
      <Reviews dictionary={dictionary} rating={rating} />
      <Hours dictionary={dictionary} />
      <CtaBand dictionary={dictionary} offer={offer} />
      <Contact locale={locale} dictionary={dictionary} />
      <JsonLd
        data={homeGraph(siteIdentity(locale, dictionary.club.name), {
          description: dictionary.meta.homeDescription,
          imageUrls: clubPhotoUrls(),
        })}
      />
    </PageShell>
  );
}
