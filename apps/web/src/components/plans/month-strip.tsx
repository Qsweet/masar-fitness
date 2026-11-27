import type { MonthStrip as Strip } from "@masar/domain";
import styles from "./month-strip.module.css";

interface MonthStripProps {
  readonly strip: Strip;
  /** «12 شهرًا» تحت الأشهر المدفوعة */
  readonly paidText: string;
  /** «+ شهران مجانًا» تحت الذهبية؛ غائب بلا أشهر مجانية */
  readonly freeText: string | undefined;
  /** المدة كاملة منطوقة («14 شهرًا، منها شهران مجانًا»): بديل الشريط لقارئ الشاشة */
  readonly label: string;
}

/** تأخير إضاءة كل حبة عن سابقتها حين يُختار الاشتراك (يُلغى مع تقليل الحركة في CSS). */
const STEP_MS = 28;

/** حبات بعدد الأشهر؛ ترتيبها في الشريط كله يحدد تأخير إضاءتها. */
function pills(count: number, offset: number) {
  return Array.from({ length: count }, (_, index) => (
    <span
      key={index}
      className={styles.pill}
      style={{ transitionDelay: `${String((index + offset) * STEP_MS)}ms` }}
    />
  ));
}

/**
 * شريط الأشهر كخط المضمار المتقطع في الشعار: حبة لكل شهر، المدفوعة بالرمادي ثم المجانية بالأصفر،
 * وتحت الشريط اسم المدفوعة في بدايته والمجانية في نهايته. للعين فقط (`role="img"` بتسمية المدة كاملة)، والأعداد من الكتالوج.
 */
export function MonthStrip({ strip, paidText, freeText, label }: MonthStripProps) {
  const hasFree = strip.free > 0 && freeText !== undefined;
  return (
    <div className={styles.strip} role="img" aria-label={label}>
      <div className={styles.track}>
        <span className={styles.group} style={{ flexGrow: strip.paid }}>
          {pills(strip.paid, 0)}
        </span>
        {hasFree ? (
          <span className={styles.group} data-kind="free" style={{ flexGrow: strip.free }}>
            {pills(strip.free, strip.paid)}
          </span>
        ) : null}
      </div>
      <div className={styles.captions}>
        <span>{paidText}</span>
        {hasFree ? <span className={styles.free}>{freeText}</span> : null}
      </div>
    </div>
  );
}
