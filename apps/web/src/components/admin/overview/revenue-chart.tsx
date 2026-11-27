import type { ClubSummary } from "@masar/db";
import { DAYS_PER_WEEK, money, rangeDays, type DateRange } from "@masar/domain";
import type { AdminDictionary } from "@/i18n/admin";
import { formatCalendarDay } from "@/i18n/admin/format";
import { fill } from "@/i18n/fill";
import { moneyParts } from "@/i18n/format";
import { cx } from "@/lib/cx";
import { readingOrder, revenueChart, type RevenueChart } from "@/server/admin/overview/geometry";
import { loadSummary } from "@/server/admin/overview/period";
import type { PeriodSummary } from "@/server/admin/overview/summary";
import { Card, EmptyState } from "../ui/kit";
import charts from "./charts.module.css";
import { DeltaFor } from "./delta";

type ChartText = AdminDictionary["overview"]["chart"];

/** لوحة الرسم في SVG بوحداته، وعمود المحور في جهة البداية (يمينًا) خارج منطقة الأعمدة. */
const VIEW = { width: 640, height: 232, plot: 196, axis: 56, gapRatio: 0.38 } as const;
const LABEL_BASELINE = 220;
/** نزول نص المحور ليتوسط خط الشبكة. */
const TICK_TEXT_OFFSET = 4;

function sar(minor: number, currency: string): string {
  const parts = moneyParts(money(minor, currency), "ar");
  return `${parts.amount} ${parts.unit}`;
}

/** أيام بداية كل عمود: كل يوم، أو أول يوم في كل أسبوع. */
function bucketStarts(range: DateRange, unit: PeriodSummary["bars"]["unit"]): string[] {
  const days = rangeDays(range);
  return unit === "day" ? days : days.filter((_, index) => index % DAYS_PER_WEEK === 0);
}

function Ticks({
  ticks,
  plotWidth,
  currency,
}: {
  readonly ticks: RevenueChart["ticks"];
  readonly plotWidth: number;
  readonly currency: string;
}) {
  return (
    <>
      {ticks.map((tick) => (
        <g key={tick.value}>
          <line className={charts.grid} x1={0} x2={plotWidth} y1={tick.y} y2={tick.y} />
          <text
            className={charts.axis}
            x={VIEW.width}
            y={tick.y + TICK_TEXT_OFFSET}
            textAnchor="end"
          >
            {moneyParts(money(tick.value, currency), "ar").amount}
          </text>
        </g>
      ))}
    </>
  );
}

interface PlotProps {
  readonly summary: PeriodSummary;
  readonly currency: string;
  readonly starts: readonly string[];
  readonly today: string;
  readonly text: ChartText;
}

function Plot({ summary, currency, starts, today, text }: PlotProps) {
  const plotWidth = VIEW.width - VIEW.axis;
  const chart = revenueChart(summary.bars.values, summary.compareBars, {
    width: plotWidth,
    height: VIEW.plot,
    gapRatio: VIEW.gapRatio,
  });
  const ordered = readingOrder(starts);
  const label = (day: string) => (day === today ? text.today : formatCalendarDay(day));
  return (
    <svg
      className={charts.chart}
      viewBox={`0 0 ${String(VIEW.width)} ${String(VIEW.height)}`}
      aria-hidden="true"
      focusable="false"
      data-testid="revenue-chart"
    >
      <Ticks ticks={chart.ticks} plotWidth={plotWidth} currency={currency} />
      {chart.bars.map((bar, index) => (
        <rect
          key={ordered[index] ?? index}
          className={cx(
            charts.bar,
            summary.bars.unit === "day" && ordered[index] === today && charts.barToday,
          )}
          x={bar.x}
          y={bar.y}
          width={bar.width}
          height={bar.height}
          rx={2}
        />
      ))}
      {chart.compare === "" ? null : <polyline className={charts.compare} points={chart.compare} />}
      {chart.labelled.map((index) => {
        const bar = chart.bars[index];
        return bar === undefined ? null : (
          <text
            key={index}
            className={charts.axis}
            x={bar.x + bar.width / 2}
            y={LABEL_BASELINE}
            textAnchor="middle"
          >
            {label(ordered[index] ?? "")}
          </text>
        );
      })}
    </svg>
  );
}

/** جدول بديل لقارئ الشاشة: كل عمود برقمه ورقم الفترة السابقة. */
function ChartTable({ summary, starts, currency, text }: Omit<PlotProps, "today">) {
  return (
    <table className="sr-only">
      <caption>{text.title[summary.bars.unit]}</caption>
      <thead>
        <tr>
          <th scope="col">{text.columns[summary.bars.unit]}</th>
          <th scope="col">{text.columns.revenue}</th>
          <th scope="col">{text.columns.previous}</th>
        </tr>
      </thead>
      <tbody>
        {starts.map((day, index) => (
          <tr key={day}>
            <th scope="row">{formatCalendarDay(day)}</th>
            <td>{sar(summary.bars.values[index] ?? 0, currency)}</td>
            <td>{sar(summary.compareBars[index] ?? 0, currency)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface RevenueCardProps {
  readonly club: ClubSummary;
  readonly range: DateRange;
  readonly today: string;
  readonly text: AdminDictionary["overview"];
}

/**
 * الإيراد اليومي (§5.1): أعمدة بالفترة الحالية، والسابقة خطًا متقطعًا، واليوم بالأصفر، والأقدم يمينًا.
 * فوقه المجموع وفرقه، ومعه جدول لقارئ الشاشة ونص المجموعين. أكثر من 90 يومًا ⇒ أسبوعي.
 */
export async function RevenueCard({ club, range, today, text }: RevenueCardProps) {
  const summary = await loadSummary(club, range);
  const { chart } = text;
  const starts = bucketStarts(range, summary.bars.unit);
  const total = moneyParts(money(summary.revenue.value, club.currency), "ar");
  const legend = (
    <p className={charts.legend} aria-hidden="true">
      <span className={charts.legendItem}>
        <span className={charts.swatch} />
        {chart.current}
      </span>
      <span className={charts.legendItem}>
        <span className={charts.swatchCompare} />
        {chart.previous}
      </span>
    </p>
  );
  return (
    <Card title={chart.title[summary.bars.unit]} action={legend}>
      {summary.revenue.value === 0 && summary.revenue.previous === 0 ? (
        <EmptyState icon="activity" title={chart.emptyTitle} description={chart.emptyLead} />
      ) : (
        <>
          <p className={charts.total}>
            <bdi className={charts.totalValue}>{total.amount}</bdi> {total.unit}
            <DeltaFor delta={summary.revenue.delta} text={text.kpis} />
            <span className="sr-only">
              {fill(chart.summary, {
                amount: sar(summary.revenue.value, club.currency),
                previous: sar(summary.revenue.previous, club.currency),
              })}
            </span>
          </p>
          <Plot
            summary={summary}
            currency={club.currency}
            starts={starts}
            today={today}
            text={chart}
          />
          <ChartTable summary={summary} starts={starts} currency={club.currency} text={chart} />
        </>
      )}
    </Card>
  );
}
