import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { INTRO_ID } from "@/components/page-intro";
import { PageShell } from "@/components/page-shell";
import { PlanHero, PlanTerms } from "@/components/plans/plan-detail";
import { toPlanViews } from "@/components/plans/plan-view";
import { Contact } from "@/components/home/contact";
import { Benefits, Payment } from "@/components/plans/extras";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/locales";
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

/**
 * صفحة اشتراك واحد، عرض مركّز لا محدِّد مكرر: السعر والمدة وزر واحد، ثم ما يشمله، ثم شروطه
 * (التفعيل والتجميد وأنه شخصي) من شروط النادي الحالية، ثم التواصل. المقارنة في صفحة الاشتراكات.
 */
export default async function PlanPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const [plans, plan] = await Promise.all([getMembershipPlans(), getMembershipPlan(slug)]);
  const checkoutEnabled = isCheckoutEnabled();
  // الأوفر شهريًا محسوب بين كل الاشتراكات المعروضة، لا من هذا وحده
  const view = toPlanViews(plans, locale, checkoutEnabled).find((item) => item.slug === slug);
  if (plan === undefined || view === undefined) {
    notFound();
  }
  const dictionary = getDictionary(locale);
  const purchaseLabel = view.purchase.external
    ? dictionary.plan.buyWhatsapp
    : dictionary.plan.buyOnline;

  return (
    <PageShell
      locale={locale}
      path={`/memberships/${plan.slug}`}
      mobileAction={{ ...view.purchase, label: purchaseLabel }}
    >
      <PlanHero
        id={INTRO_ID}
        plan={view}
        summary={plan.summary[locale]}
        locale={locale}
        dictionary={dictionary}
      />
      <Benefits
        eyebrow={dictionary.facilities.eyebrow}
        title={dictionary.plan.includesTitle}
        benefits={view.benefits}
      />
      <PlanTerms plan={view} locale={locale} dictionary={dictionary} />
      {checkoutEnabled ? <Payment dictionary={dictionary} /> : null}
      <Contact locale={locale} dictionary={dictionary} />
    </PageShell>
  );
}
