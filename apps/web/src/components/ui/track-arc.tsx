import { cx } from "@/lib/cx";
import styles from "./track-arc.module.css";

/**
 * منحنى المضمار من الشعار، مرسومًا هنا لا منسوخًا: شريط عريض شفيف وفي وسطه خط أصفر متقطع، يصعد من
 * أسفل البداية إلى أعلى النهاية كمضمار العدّاء. زخرفي دائمًا (aria-hidden) ولا يلتقط اللمس.
 * سماكة الخطوط ثابتة بالبكسل مهما تمدد المنحنى مع عرض القسم.
 */
const CURVE = "M -20 330 C 260 420, 760 400, 1020 -20";

interface TrackArcProps {
  readonly className?: string | undefined;
  /** شريط معتم بلون --lane (فوق الأصفر) بدل الشفيف (فوق الأسود) */
  readonly solid?: boolean;
}

export function TrackArc({ className, solid = false }: TrackArcProps) {
  return (
    <svg
      className={cx(styles.arc, solid && styles.solid, className)}
      viewBox="0 0 1000 400"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path className={styles.lane} d={CURVE} />
      <path className={styles.dashes} d={CURVE} />
    </svg>
  );
}
