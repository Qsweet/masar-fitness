import type { PromotionAdminRow } from "@masar/db";
import type { AdminDictionary } from "@/i18n/admin";
import { formatDay } from "@/i18n/admin/format";
import { formatNumber } from "@/i18n/format";
import { promotionFacts, usageText } from "@/server/admin/sales/promotions-view";
import { Alert, Facts } from "../ui/kit";
import { SettingsSection } from "../ui/section";
import { Amount } from "./order-parts";
import styles from "./sales.module.css";

interface SectionProps {
  readonly row: PromotionAdminRow;
  readonly dictionary: AdminDictionary;
  readonly timezone: string;
}

/** شروط العرض كما هي محفوظة: النوع والرمز والخصم والنطاق والجمهور والنافذة والحدّان. */
export function PromotionFactsCard({ row, dictionary, timezone }: SectionProps) {
  const labels = dictionary.sales.promotions.detail;
  return (
    <SettingsSection title={labels.factsTitle}>
      <Facts
        items={[
          ...promotionFacts(row, timezone, dictionary).map(
            ([label, value]) => [label, <bdi key={label}>{value}</bdi>] as const,
          ),
          [labels.created, formatDay(row.createdAt, timezone)],
        ]}
      />
    </SettingsSection>
  );
}

/** عدّادات الاستخدام من `order_discounts`: النشط من الحد، والمدفوع، والخصم الممنوح، والكل. */
export function PromotionUsageCard({ row, dictionary }: Omit<SectionProps, "timezone">) {
  const text = dictionary.sales.promotions;
  const labels = text.detail;
  return (
    <SettingsSection title={labels.usageTitle} description={labels.usageLead}>
      <dl className={styles.counters} data-testid="promotion-usage">
        <div className={styles.counter}>
          <dt>{labels.active}</dt>
          <dd>{usageText(row, text)}</dd>
        </div>
        <div className={styles.counter}>
          <dt>{labels.paidOrders}</dt>
          <dd>{formatNumber(row.usage.paidOrders)}</dd>
        </div>
        <div className={styles.counter}>
          <dt>{labels.granted}</dt>
          <dd>
            <Amount value={row.usage.discountGranted} />
          </dd>
        </div>
        <div className={styles.counter}>
          <dt>{labels.total}</dt>
          <dd>{formatNumber(row.usage.total)}</dd>
        </div>
      </dl>
      {row.state === "exhausted" ? <Alert tone="warning">{labels.exhaustedNote}</Alert> : null}
    </SettingsSection>
  );
}
