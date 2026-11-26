"use client";

import { PlanOption } from "@/components/plans/plan-option";
import type { PlanView } from "@/components/plans/plan-view";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/locales";
import styles from "./sales.module.css";

export interface PreviewCard {
  readonly locale: Locale;
  /** اسم اللغة فوق بطاقتها. */
  readonly label: string;
  readonly view: PlanView;
  /** نصوص البطاقة من قاموس الموقع العام بلغتها. */
  readonly labels: Dictionary["plans"];
}

const noop = (): void => undefined;

/**
 * معاينة بطاقة الاشتراك: `PlanOption` العام نفسه بنموذج عرضه نفسه، على أرضية الموقع ورموزه. `inert`:
 * البطاقة للعرض فلا تُنقر ولا تأخذ تركيزًا ولا يقرؤها قارئ الشاشة كعنصر تحكم.
 */
export function PlanPreview({ cards }: { readonly cards: readonly PreviewCard[] }) {
  return (
    <div className={styles.previewStage} data-testid="plan-preview">
      {cards.map((card) => (
        <div
          key={card.locale}
          className={styles.previewCard}
          lang={card.locale}
          dir={card.locale === "ar" ? "rtl" : "ltr"}
        >
          <p className={styles.previewLocale}>{card.label}</p>
          <div inert>
            <PlanOption plan={card.view} selected={false} labels={card.labels} onSelect={noop} />
          </div>
        </div>
      ))}
    </div>
  );
}
