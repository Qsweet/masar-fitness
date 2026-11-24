import { locale as currentLocale } from "next/root-params";
import { PageIntro } from "@/components/page-intro";
import { PageShell } from "@/components/page-shell";
import { PlanShopSkeleton } from "@/components/plans/plan-shop-skeleton";
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
      <PageIntro title={dictionary.memberships.title} lead={dictionary.memberships.intro} />
      <section className="surface-light py-4 md:py-14">
        <div className="page-container">
          <PlanShopSkeleton label={dictionary.loading} />
        </div>
      </section>
    </PageShell>
  );
}
