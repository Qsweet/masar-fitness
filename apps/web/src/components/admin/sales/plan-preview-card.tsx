import type { CatalogProductDetail } from "@masar/db";
import type { MembershipPlan } from "@masar/domain";
import { CLUB_FACTS } from "@/config/club-facts";
import type { AdminDictionary } from "@/i18n/admin";
import { defaultDictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/fill";
import { LOCALES } from "@/i18n/locales";
import { planOf, previewView } from "@/server/admin/sales/catalog-view";
import { Alert, Card, uiStyles } from "../ui/kit";
import { PlanPreview, type PreviewCard } from "./plan-preview";

interface PreviewProps {
  readonly product: CatalogProductDetail;
  /** الباقات المعروضة في الموقع الآن: عليها تُحسب شارة «الأكثر قيمة». */
  readonly published: readonly MembershipPlan[];
  readonly text: AdminDictionary["sales"]["plans"];
}

/**
 * معاينة بطاقة الاشتراك باللغتين: نموذج العرض العام نفسه (`toPlanViews`) والمكوّن العام نفسه، ومعها ما
 * هو محسوب ولا يُعدَّل من هنا: شارة «الأكثر قيمة» وسطر التجميد.
 */
export function PlanPreviewCard({ product, published, text }: PreviewProps) {
  const labels = text.detail;
  const plan = planOf(product);
  if (plan === undefined) {
    return (
      <Card title={labels.previewTitle}>
        <Alert tone="warning">{labels.previewUnavailable}</Alert>
      </Card>
    );
  }
  const cards = LOCALES.flatMap((locale): PreviewCard[] => {
    const view = previewView(published, plan, locale);
    return view === undefined
      ? []
      : [
          {
            locale,
            label: labels.previewLocales[locale],
            view,
            labels: defaultDictionary(locale).plans,
          },
        ];
  });
  const best = cards.some((card) => card.view.isBestValue);
  return (
    <Card title={labels.previewTitle} description={labels.previewLead}>
      {product.status === "active" ? null : <Alert tone="info">{labels.previewDraft}</Alert>}
      <PlanPreview cards={cards} />
      <p className={uiStyles.note}>{best ? labels.previewBest : labels.previewNotBest}</p>
      <p className={uiStyles.note}>
        {fill(labels.previewFreeze, { days: String(CLUB_FACTS.freezeDaysPerPaidMonth) })}
      </p>
    </Card>
  );
}
