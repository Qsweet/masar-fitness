import { locale as currentLocale } from "next/root-params";
import { PageShell } from "@/components/page-shell";
import { PlanLanesSkeleton } from "@/components/plans/plan-lanes-skeleton";
import { getDictionary } from "@/i18n/dictionaries";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/locales";

/**
 * هيكل التحميل لصفحة القائمة فقط (مجموعة المسار «list»): لو شمل صفحة الباقة لبدأ الرد بحالة 200
 * قبل أن تُعرف الباقة غير الموجودة، فتضيع حالة 404 الصحيحة.
 */
export default async function MembershipsLoading() {
  const raw = await currentLocale();
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const dictionary = getDictionary(locale);
  return (
    <PageShell locale={locale} path="/memberships">
      <section className="surface-asphalt pt-14 pb-20 md:pt-20 md:pb-28">
        <div className="page-container">
          <h1 className="mb-10 text-title font-display">{dictionary.memberships.title}</h1>
          <PlanLanesSkeleton label={dictionary.loading} />
        </div>
      </section>
    </PageShell>
  );
}
