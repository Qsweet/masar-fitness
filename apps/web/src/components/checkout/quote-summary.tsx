import type { Dictionary } from "@/i18n/dictionaries";
import type { QuoteView } from "./quote-view";
import { LineList, Totals } from "./totals";
import styles from "./quote-summary.module.css";

interface QuoteSummaryProps {
  readonly view: QuoteView;
  readonly labels: Dictionary["checkout"]["summary"];
}

/**
 * ملخص الطلب قبل الجوال: كل رقم محسوب على الخادم بمحرك الطلب نفسه. منطقة حية: تحديث
 * الخيارات يعيد عرضها فيقرؤها قارئ الشاشة.
 */
export function QuoteSummary({ view, labels }: QuoteSummaryProps) {
  return (
    <section aria-labelledby="quote-summary-title" aria-live="polite" className={styles.summary}>
      <h2 id="quote-summary-title" className={styles.title}>
        {labels.title}
      </h2>
      <LineList lines={view.lines} />
      <Totals discounts={view.discounts} totals={view.totals} labels={labels} />
      {view.startRule === undefined && view.notes.length === 0 ? null : (
        <ul className={styles.notes}>
          {view.startRule === undefined ? null : <li>{view.startRule}</li>}
          {view.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
