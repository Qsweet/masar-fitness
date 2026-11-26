import type { DailyOrders } from "@masar/db";
import type { AdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { formatNumber } from "@/i18n/format";
import { cx } from "@/lib/cx";
import { barChart, type BarChart } from "@/server/admin/overview-view";
import { EmptyState } from "../ui/kit";
import styles from "./overview.module.css";

/** أبعاد لوحة الرسم بوحدات ‎viewBox‎: منطقة الأعمدة، وهامش لأرقام المحور، وسطر لأيام الشهر. */
const PLOT_WIDTH = 600;
const PLOT_HEIGHT = 150;
const AXIS_WIDTH = 34;
const LABEL_HEIGHT = 22;
const TOP_PAD = 8;
const GAP_RATIO = 0.38;
const AXIS_TEXT_OFFSET = 8;
const DAY_TEXT_OFFSET = 15;
const TEXT_DROP = 4;
const BAR_RADIUS = 2;
const DAY_OF_MONTH_START = 8;

interface OrdersChartProps {
  readonly series: readonly DailyOrders[];
  readonly text: AdminDictionary["overview"]["chart"];
  readonly titleId: string;
}

/** الأقدم يمينًا: يُعكس موضع كل عمود داخل منطقة الرسم. */
function mirrored(x: number, barWidth: number): number {
  return PLOT_WIDTH - x - barWidth;
}

function GridLines({ chart }: { readonly chart: BarChart }) {
  return chart.ticks.map((tick) => (
    <g key={tick.value}>
      <line
        x1={0}
        x2={PLOT_WIDTH}
        y1={tick.y}
        y2={tick.y}
        className={tick.value === 0 ? styles.baseLine : styles.gridLine}
      />
      <text
        x={PLOT_WIDTH + AXIS_TEXT_OFFSET}
        y={tick.y + TEXT_DROP}
        className={styles.axisText}
        direction="ltr"
      >
        {formatNumber(tick.value)}
      </text>
    </g>
  ));
}

function Bars({ chart, days }: { readonly chart: BarChart; readonly days: readonly string[] }) {
  return chart.bars.map((bar, index) => (
    <g key={days[index]}>
      <rect
        x={mirrored(bar.x, bar.width)}
        y={bar.y}
        width={bar.width}
        height={bar.height}
        rx={BAR_RADIUS}
        className={cx(styles.bar, index === chart.bars.length - 1 && styles.barToday)}
      />
      {index % 2 === 1 ? (
        <text
          x={mirrored(bar.x, bar.width) + bar.width / 2}
          y={PLOT_HEIGHT + DAY_TEXT_OFFSET}
          textAnchor="middle"
          className={styles.axisText}
          direction="ltr"
        >
          {Number(days[index]?.slice(DAY_OF_MONTH_START))}
        </text>
      ) : null}
    </g>
  ));
}

/** القيم نفسها جدولًا لقارئ الشاشة. */
function ValuesTable({ series, text }: Pick<OrdersChartProps, "series" | "text">) {
  return (
    <table className="sr-only">
      <caption>{text.description}</caption>
      <thead>
        <tr>
          <th scope="col">{text.day}</th>
          <th scope="col">{text.orders}</th>
        </tr>
      </thead>
      <tbody>
        {series.map((day) => (
          <tr key={day.day}>
            <th scope="row">{day.day}</th>
            <td>{day.created}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * أعمدة الطلبات اليومية، مرسومة على الخادم SVG بلا سكربت ولا نمط سطري (الألوان أصناف CSS). الزمن
 * يجري مع اتجاه القراءة: الأقدم في جهة البداية (اليمين) واليوم في النهاية بلون التمييز. القيم نفسها
 * في جدول لقارئ الشاشة.
 */
export function OrdersChart({ series, text, titleId }: OrdersChartProps) {
  const values = series.map((day) => day.created);
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total === 0) {
    return <EmptyState icon="orders" title={text.emptyTitle} description={text.emptyLead} />;
  }
  const chart = barChart(values, { width: PLOT_WIDTH, height: PLOT_HEIGHT, gapRatio: GAP_RATIO });
  const width = PLOT_WIDTH + AXIS_WIDTH;
  const height = TOP_PAD + PLOT_HEIGHT + LABEL_HEIGHT;
  return (
    <>
      <svg
        viewBox={`0 0 ${String(width)} ${String(height)}`}
        className={styles.chart}
        role="img"
        aria-labelledby={titleId}
        data-testid="orders-chart"
      >
        <g transform={`translate(0 ${String(TOP_PAD)})`}>
          <GridLines chart={chart} />
          <Bars chart={chart} days={series.map((day) => day.day)} />
        </g>
      </svg>
      <p className={styles.chartMeta}>{fill(text.total, { count: formatNumber(total) })}</p>
      <ValuesTable series={series} text={text} />
    </>
  );
}
