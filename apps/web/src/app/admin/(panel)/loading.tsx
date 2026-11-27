import { CardSkeleton, KpiSkeleton } from "@/components/admin/overview/skeleton";

/**
 * هيكل تحميل صفحات اللوحة (ADMIN_REDESIGN §6.3) حين تنتظر الصفحة قراءتها الأولى: بأبعاد البطاقات لا
 * دوّار في الوسط، والهيكل الجانبي والعلوي قائمان. لا بيانات ولا جلسة تُقرأ هنا.
 */
export default function PanelLoading() {
  return (
    <>
      <KpiSkeleton />
      <CardSkeleton kind="chart" />
    </>
  );
}
