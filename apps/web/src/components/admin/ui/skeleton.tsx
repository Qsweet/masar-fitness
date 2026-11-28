import { getAdminDictionary } from "@/i18n/admin";
import { cx } from "@/lib/cx";
import styles from "./skeleton.module.css";

/** عدد صفوف هيكل الجدول: صفحة تحميل بأبعاد قريبة من النهائية دون أن تملأ الشاشة. */
const SKELETON_ROWS = 6;
const ROWS = Array.from({ length: SKELETON_ROWS }, (_, index) => index);

/** شريط رمادي بأبعاد عنصر قادم. زخرفي؛ النص المعلَن في `PageSkeleton`. */
export function Skeleton({
  size = "line",
}: {
  readonly size?: "title" | "line" | "short" | "row";
}) {
  return <span className={cx(styles.bone, styles[size])} aria-hidden="true" />;
}

/**
 * هيكل صفحة أثناء التحميل (ADMIN_REDESIGN §6.3): رأس ثم بطاقة صفوف بالأبعاد النهائية، لا دوّار في وسط
 * الصفحة. لقارئ الشاشة جملة حالة واحدة. الوميض يتوقف مع تقليل الحركة.
 */
export function PageSkeleton() {
  const { kit } = getAdminDictionary();
  return (
    <div className={styles.page} aria-busy="true">
      <p role="status" className="sr-only">
        {kit.loading}
      </p>
      <div className={styles.head}>
        <Skeleton size="title" />
        <Skeleton size="short" />
      </div>
      <div className={styles.card}>
        {ROWS.map((row) => (
          <div key={row} className={styles.row}>
            <Skeleton size="row" />
            <Skeleton size="short" />
          </div>
        ))}
      </div>
    </div>
  );
}
