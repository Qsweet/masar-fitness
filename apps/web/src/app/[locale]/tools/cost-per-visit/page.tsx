import { parseVisitsPerWeek } from "@masar/domain";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageIntro } from "@/components/page-intro";
import { PageShell } from "@/components/page-shell";
import { CostPerVisit } from "@/components/tools/cost-per-visit";
import { costRows } from "@/components/tools/cost-per-visit-view";
import { ROUTES } from "@/config/routes";
import { isLocale } from "@/i18n/locales";
import { getMembershipPlans } from "@/server/catalog";
import { pageMetadata } from "@/server/metadata";
import { getSiteContent } from "@/server/content/site-content";

type Props = PageProps<"/[locale]/tools/cost-per-visit">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) {
    return {};
  }
  const text = (await getSiteContent(locale)).dictionary.tools.costPerVisit;
  // الرابط المعتمد بلا ‎?visits=‎: كل النتائج صفحة واحدة لمحركات البحث
  return pageMetadata({
    locale,
    path: ROUTES.costPerVisit,
    title: text.metaTitle,
    description: text.metaDescription,
  });
}

export default async function CostPerVisitPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const visits = parseVisitsPerWeek((await searchParams).visits);
  const { dictionary } = await getSiteContent(locale);
  const rows = costRows(await getMembershipPlans(), visits, locale);
  return (
    <PageShell locale={locale} path={ROUTES.costPerVisit}>
      <PageIntro
        title={dictionary.tools.costPerVisit.title}
        lead={dictionary.tools.costPerVisit.lead}
      />
      <CostPerVisit visits={visits} rows={rows} locale={locale} dictionary={dictionary} />
    </PageShell>
  );
}
