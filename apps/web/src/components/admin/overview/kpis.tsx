import type { ClubSummary } from "@masar/db";
import { money, type DateRange } from "@masar/domain";
import type { ReactNode } from "react";
import { ADMIN_ROUTES } from "@/config/admin";
import type { AdminDictionary } from "@/i18n/admin";
import { fill, fillNodes } from "@/i18n/fill";
import { formatNumber, moneyParts } from "@/i18n/format";
import { sparkline } from "@/server/admin/overview/geometry";
import { awaitingPaymentCount } from "@/server/admin/cached-reads";
import { loadSummary } from "@/server/admin/overview/period";
import type { PeriodSummary } from "@/server/admin/overview/summary";
import { Card, CardLink } from "../ui/kit";
import charts from "./charts.module.css";
import { DeltaBadge, DeltaFor, formatPercentTenths, formatTenths } from "./delta";
import styles from "./kpis.module.css";

type KpiText = AdminDictionary["overview"]["kpis"];

const BPS_PER_TENTH_PERCENT = 10;
const SPARK = { width: 100, height: 40 } as const;

function amount(minor: number, currency: string): { amount: string; unit: string } {
  return moneyParts(money(minor, currency), "ar");
}

interface SparkSeries {
  readonly trend: readonly (number | null)[];
  readonly compare: readonly (number | null)[];
}

function Spark({ metric }: { readonly metric: SparkSeries }) {
  const lines = sparkline(metric.trend, metric.compare, SPARK.width, SPARK.height);
  return (
    <svg
      className={charts.spark}
      viewBox={`0 0 ${String(SPARK.width)} ${String(SPARK.height)}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {lines.area === "" ? null : <path className={charts.sparkArea} d={lines.area} />}
      {lines.compare === "" ? null : <path className={charts.sparkCompare} d={lines.compare} />}
      <path className={charts.sparkLine} d={lines.line} />
    </svg>
  );
}

interface KpiProps {
  readonly id: string;
  readonly label: ReactNode;
  readonly value: ReactNode;
  readonly meta: ReactNode;
  readonly children?: ReactNode;
}

function Kpi({ id, label, value, meta, children }: KpiProps) {
  return (
    <section className={styles.kpi} data-testid={`kpi-${id}`} aria-labelledby={`kpi-${id}-label`}>
      <h3 id={`kpi-${id}-label`} className={styles.kpiLabel}>
        {label}
      </h3>
      <p className={styles.kpiValue} data-testid={`kpi-${id}-value`}>
        {value}
      </p>
      <p className={styles.kpiMeta}>{meta}</p>
      {children}
    </section>
  );
}

function Money({ minor, currency }: { readonly minor: number; readonly currency: string }) {
  const parts = amount(minor, currency);
  return (
    <>
      <bdi>{parts.amount}</bdi> <span className={styles.kpiUnit}>{parts.unit}</span>
    </>
  );
}

/** «مقابل 33,190»: رقم الفترة السابقة معزول الاتجاه (علامة % لا تنقلب). */
function Against({ text, value }: { readonly text: KpiText; readonly value: string }) {
  return <span>{fillNodes(text.against, { value: <bdi key="value">{value}</bdi> })}</span>;
}

/** نسبة الإتمام بنقاط الأساس كما تُعرض: «73.1%»، أو «—» بلا طلبات. */
function rate(bps: number | null): string {
  return bps === null ? "—" : formatPercentTenths(Math.round(bps / BPS_PER_TENTH_PERCENT));
}

interface MetricCardProps {
  readonly summary: PeriodSummary;
  readonly currency: string;
  readonly text: KpiText;
}

function RevenueKpi({ summary, currency, text }: MetricCardProps) {
  const { revenue } = summary;
  return (
    <Kpi
      id="revenue"
      label={text.revenue}
      value={<Money minor={revenue.value} currency={currency} />}
      meta={
        <>
          <DeltaFor delta={revenue.delta} text={text} />
          <Against text={text} value={amount(revenue.previous, currency).amount} />
        </>
      }
    >
      <Spark metric={revenue} />
    </Kpi>
  );
}

function PaidKpi({ summary, text }: Omit<MetricCardProps, "currency">) {
  const { paid } = summary;
  return (
    <Kpi
      id="paid"
      label={text.paid}
      value={<bdi>{formatNumber(paid.value)}</bdi>}
      meta={
        <>
          <DeltaFor delta={paid.delta} text={text} />
          <Against text={text} value={formatNumber(paid.previous)} />
        </>
      }
    >
      <Spark metric={paid} />
    </Kpi>
  );
}

function CompletionKpi({ summary, text }: Omit<MetricCardProps, "currency">) {
  const { completion } = summary;
  return (
    <Kpi
      id="completion"
      label={text.completion}
      value={<bdi>{rate(completion.value)}</bdi>}
      meta={
        <>
          {completion.delta === null ? null : (
            <DeltaBadge
              direction={completion.delta.direction}
              value={fill(text.points, { value: formatTenths(completion.delta.tenths) })}
              text={text}
            />
          )}
          {completion.value === null ? (
            text.noOrdersInRange
          ) : (
            <Against text={text} value={rate(completion.previous)} />
          )}
        </>
      }
    >
      <Spark metric={completion} />
    </Kpi>
  );
}

function AwaitingKpi({ awaiting, text }: { readonly awaiting: number; readonly text: KpiText }) {
  return (
    <Kpi
      id="awaiting"
      label={
        <>
          {text.awaiting}
          <span className={styles.live}>{text.live}</span>
        </>
      }
      value={<bdi>{formatNumber(awaiting)}</bdi>}
      meta={text.awaitingHint}
    >
      {awaiting === 0 ? null : (
        <span className={styles.kpiLink}>
          <CardLink href={`${ADMIN_ROUTES.orders}?tab=awaiting`}>{text.showAwaiting}</CardLink>
        </span>
      )}
    </Kpi>
  );
}

interface KpiCardsProps {
  readonly club: ClubSummary;
  readonly range: DateRange;
  readonly text: KpiText;
}

/**
 * أربعة مؤشرات للفترة (§5.1): الإيراد بيوم الدفع، والطلبات المدفوعة، ونسبة إتمام الدفع (فرقها بالنقاط)،
 * وبانتظار الدفع الآن (لحظي بلا خط ولا فرق، القرار 64-6). الفرق يُخفى حين السابقة صفر (64-8).
 */
export async function KpiCards({ club, range, text }: KpiCardsProps) {
  const [summary, awaiting] = await Promise.all([
    loadSummary(club, range),
    awaitingPaymentCount(club.id),
  ]);
  return (
    <div className={styles.kpiGrid} aria-label={text.label} role="group">
      <RevenueKpi summary={summary} currency={club.currency} text={text} />
      <PaidKpi summary={summary} text={text} />
      <CompletionKpi summary={summary} text={text} />
      <AwaitingKpi awaiting={awaiting} text={text} />
    </div>
  );
}

/** قبل أول طلب (§5.1): شريط مضغوط بأصفار رمادية، وتحت كلٍّ سببها، بدل حالة فارغة كبيرة. */
export function KpiStrip({
  currency,
  text,
}: {
  readonly currency: string;
  readonly text: KpiText;
}) {
  const items = [
    ["revenue", text.revenue, <Money key="v" minor={0} currency={currency} />],
    ["paid", text.paid, <bdi key="v">0</bdi>],
    ["completion", text.completion, <bdi key="v">—</bdi>],
    ["awaiting", text.awaiting, <bdi key="v">0</bdi>],
  ] as const;
  return (
    <Card flush>
      <div className={styles.strip} role="group" aria-label={text.label}>
        {items.map(([id, label, value]) => (
          <div key={id} className={styles.stripItem} data-testid={`kpi-${id}`}>
            <span className={styles.kpiLabel}>{label}</span>
            <span className={styles.kpiValue} data-testid={`kpi-${id}-value`}>
              {value}
            </span>
            <span className={styles.kpiMeta}>{text.startsWithFirstOrder}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
