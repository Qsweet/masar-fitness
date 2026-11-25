import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import { About } from "@/components/home/about";
import { Contact } from "@/components/home/contact";
import { CtaBand } from "@/components/home/cta-band";
import { Facilities } from "@/components/home/facilities";
import { Hero, HERO_ACTIONS_ID } from "@/components/home/hero";
import { offerView, ratingView } from "@/components/home/home-view";
import { Hours } from "@/components/home/hours";
import { weekdayHours } from "@/components/home/hours-view";
import { Reviews } from "@/components/home/reviews";
import { Services } from "@/components/home/services";
import { friendsView, serviceViews } from "@/components/home/services-view";
import { Team } from "@/components/home/team";
import { Why } from "@/components/home/why";
import { PageShell } from "@/components/page-shell";
import { FriendsOffer } from "@/components/plans/friends-offer";
import { toPlanViews } from "@/components/plans/plan-view";
import { PlansSection } from "@/components/plans/plans-section";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/locales";
import { getMembershipPlans } from "@/server/catalog";
import { isCheckoutEnabled } from "@/server/checkout/flag";
import { pageMetadata } from "@/server/metadata";
import { clubPhotoUrls, siteIdentity } from "@/server/site-identity";
import { homeGraph } from "@/server/structured-data";

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

/**
 * الرئيسية بإيقاع قالب «نبض» وبمحتوى النادي الحقيقي: الواجهة، من نحن، المرافق، لماذا (القسم الداكن)،
 * الفريق، الآراء، الاشتراكات وعرض الأصدقاء، البرامج، الأوقات، شريط الدعوة، التواصل.
 */
export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const dictionary = getDictionary(locale);
  const plans = toPlanViews(await getMembershipPlans(), locale, isCheckoutEnabled());
  const offer = offerView(plans, dictionary);
  const rating = ratingView(dictionary, locale);
  const weekday = weekdayHours(dictionary);

  return (
    <PageShell locale={locale} path={PATH} hasPlans={plans.length > 0}>
      <Hero dictionary={dictionary} offer={offer} rating={rating} weekday={weekday} />
      <About dictionary={dictionary} />
      <Facilities dictionary={dictionary} />
      <Why dictionary={dictionary} weekday={weekday} />
      <Team dictionary={dictionary} />
      <Reviews dictionary={dictionary} rating={rating} />
      <PlansSection
        plans={plans}
        locale={locale}
        dictionary={dictionary}
        revealAfterId={HERO_ACTIONS_ID}
        showCompare
      >
        <FriendsOffer dictionary={dictionary} view={friendsView(dictionary, locale)} />
      </PlansSection>
      <Services dictionary={dictionary} services={serviceViews(dictionary, locale)} />
      <Hours dictionary={dictionary} />
      <CtaBand dictionary={dictionary} offer={offer} />
      <Contact locale={locale} dictionary={dictionary} />
      <JsonLd
        data={homeGraph(siteIdentity(locale), {
          description: dictionary.meta.homeDescription,
          imageUrls: clubPhotoUrls(),
        })}
      />
    </PageShell>
  );
}
