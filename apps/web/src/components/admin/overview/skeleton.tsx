import { cx } from "@/lib/cx";
import styles from "./overview.module.css";

/**
 * هيكل تحميل بطاقة بأبعادها النهائية (§6.3): لا دوّار في الوسط ولا انزياح حين تصل الأرقام، ووميض خفيف
 * يتوقف مع تقليل الحركة.
 */
export function CardSkeleton({ kind }: { readonly kind: "kpi" | "chart" | "card" }) {
  return (
    <div
      className={cx(
        styles.skeleton,
        kind === "kpi" && styles.skeletonKpi,
        kind === "chart" && styles.skeletonChart,
      )}
      aria-hidden="true"
    />
  );
}

export function KpiSkeleton() {
  return (
    <div className={styles.kpiGrid} aria-hidden="true">
      <CardSkeleton kind="kpi" />
      <CardSkeleton kind="kpi" />
      <CardSkeleton kind="kpi" />
      <CardSkeleton kind="kpi" />
    </div>
  );
}
