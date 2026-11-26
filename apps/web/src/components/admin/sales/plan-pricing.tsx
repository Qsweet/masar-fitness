import type { CatalogProductDetail, CatalogVersionRow } from "@masar/db";
import type { AdminDictionary } from "@/i18n/admin";
import { formatAmount, formatDateTime } from "@/i18n/admin/format";
import { fillNodes } from "@/i18n/fill";
import { formatMonths, formatNumber } from "@/i18n/format";
import { formatRate, includedVat } from "@/server/admin/sales/catalog-view";
import { Cell, DataTable } from "../ui/data-table";
import { Alert, Badge, Card, Facts, uiStyles } from "../ui/kit";
import { Amount } from "./order-parts";
import styles from "./sales.module.css";

type PlansText = AdminDictionary["sales"]["plans"];

interface CurrentProps {
  readonly product: CatalogProductDetail;
  readonly text: PlansText;
  /** نسبة ضريبة النادي بنقاط الأساس: السعر شامل لها، وما منه ضريبة يُحسب في المجال. */
  readonly vatRateBps: number;
}

/** السعر الساري الآن وما منه ضريبة، والمدة والأشهر المجانية، والمزايا. */
export function CurrentTermsCard({ product, text, vatRateBps }: CurrentProps) {
  const labels = text.detail;
  const version = product.currentVersion;
  if (version === null) {
    return (
      <Card title={labels.currentTitle}>
        <Alert tone="warning">{labels.noCurrent}</Alert>
      </Card>
    );
  }
  // المبلغ والنسبة معزولا الاتجاه: «15%» لا تنقلب داخل الجملة العربية
  const vat = fillNodes(labels.vatIncluded, {
    amount: <bdi key="amount">{formatAmount(includedVat(version.price, vatRateBps))}</bdi>,
    rate: <bdi key="rate">{formatRate(vatRateBps)}</bdi>,
  });
  const membership = product.kind === "membership";
  const months = (value: number | null, none: string): string =>
    value === null || value === 0 ? none : formatMonths(value, "ar");
  return (
    <Card title={labels.currentTitle}>
      <Facts
        items={[
          [
            labels.price,
            <span key="price" data-testid="current-price">
              <strong>
                <Amount value={version.price} />
              </strong>
              <span className={styles.sub}>{vat}</span>
            </span>,
          ],
          ...(membership
            ? ([
                [labels.duration, months(version.durationMonths, text.noDuration)],
                [labels.bonus, months(version.bonusMonths, labels.noBonus)],
              ] as const)
            : []),
        ]}
      />
      <div>
        <p className={uiStyles.label}>{labels.benefits}</p>
        {version.benefits.length === 0 ? (
          <p className={uiStyles.note}>{labels.noBenefits}</p>
        ) : (
          <ul className={styles.benefitList}>
            {version.benefits.map((benefit) => (
              <li key={`${benefit.ar}|${benefit.en}`}>{benefit.ar}</li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function versionState(version: CatalogVersionRow, now: Date): "current" | "past" | "scheduled" {
  if (version.current) {
    return "current";
  }
  return version.validFrom.getTime() > now.getTime() ? "scheduled" : "past";
}

interface HistoryProps {
  readonly product: CatalogProductDetail;
  readonly text: PlansText;
  readonly timezone: string;
  readonly now: Date;
}

/** سجل النسخ الأحدث أولًا: السعر والمدة والمجاني، ومدة السريان، وكم بيع من كل نسخة. */
export function VersionHistoryCard({ product, text, timezone, now }: HistoryProps) {
  const labels = text.detail;
  const columns = labels.history;
  const months = (value: number | null): string =>
    value === null || value === 0 ? "—" : formatMonths(value, "ar");
  return (
    <Card title={labels.historyTitle} description={labels.historyLead} flush>
      <DataTable
        caption={labels.historyTitle}
        columns={Object.values(columns)}
        testId="versions-table"
      >
        {product.versions.map((version) => {
          const state = versionState(version, now);
          return (
            <tr key={version.id}>
              <Cell label={columns.price} nowrap strong>
                <Amount value={version.price} />
              </Cell>
              <Cell label={columns.duration} nowrap>
                {months(version.durationMonths)}
              </Cell>
              <Cell label={columns.bonus} nowrap>
                {months(version.bonusMonths)}
              </Cell>
              <Cell label={columns.from} muted nowrap>
                {formatDateTime(version.validFrom, timezone)}
              </Cell>
              <Cell label={columns.until} muted nowrap>
                {version.validUntil === null
                  ? labels.open
                  : formatDateTime(version.validUntil, timezone)}
              </Cell>
              <Cell label={columns.sold} align="numeric">
                {formatNumber(version.soldItems)}
              </Cell>
              <Cell label={columns.state}>
                <Badge
                  tone={
                    state === "current" ? "success" : state === "scheduled" ? "info" : "neutral"
                  }
                >
                  {labels.versionStates[state]}
                </Badge>
              </Cell>
            </tr>
          );
        })}
      </DataTable>
    </Card>
  );
}
