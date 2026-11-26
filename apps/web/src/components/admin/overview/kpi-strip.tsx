import { money } from "@masar/domain";
import type { ReactNode } from "react";
import type { AdminDictionary } from "@/i18n/admin";
import { fillNodes } from "@/i18n/fill";
import { formatNumber, moneyParts } from "@/i18n/format";
import { cx } from "@/lib/cx";
import { sparklinePoints, type Kpi } from "@/server/admin/overview-view";
import styles from "./overview.module.css";

const SPARK_WIDTH = 80;
const SPARK_HEIGHT = 28;

interface SparklineProps {
  readonly values: readonly number[];
  readonly label: string;
}

/** خط صغير لآخر الأيام: الأقدم في جهة البداية، فيُقلب أفقيًا في RTL بسمة التحويل. */
function Sparkline({ values, label }: SparklineProps) {
  // سلسلة كلها أصفار لا اتجاه لها: لا خط يُرسم
  if (values.every((value) => value === 0)) {
    return null;
  }
  const flat = values.every((value) => value === values[0]);
  return (
    <svg
      viewBox={`0 0 ${String(SPARK_WIDTH)} ${String(SPARK_HEIGHT)}`}
      className={styles.spark}
      role="img"
      aria-label={`${label}: ${values.map((value) => formatNumber(value)).join("، ")}`}
      preserveAspectRatio="none"
    >
      <g transform={`translate(${String(SPARK_WIDTH)} 0) scale(-1 1)`}>
        <polyline
          points={sparklinePoints(values, SPARK_WIDTH, SPARK_HEIGHT)}
          className={cx(styles.sparkLine, flat && styles.sparkFlat)}
        />
      </g>
    </svg>
  );
}

interface KpiCellProps {
  readonly label: string;
  readonly value: ReactNode;
  readonly note: ReactNode;
  readonly spark?: ReactNode;
  readonly testId: string;
}

function KpiCell({ label, value, note, spark, testId }: KpiCellProps) {
  return (
    <li className={styles.kpi} data-testid={testId}>
      <span className={styles.kpiLabel}>{label}</span>
      <span className={styles.kpiValue} data-testid={`${testId}-value`}>
        {value}
      </span>
      {spark}
      <span className={styles.kpiNote}>{note}</span>
    </li>
  );
}

function DeltaNote({ kpi, text }: { kpi: Kpi; text: AdminDictionary["overview"]["kpis"] }) {
  if (kpi.delta === null) {
    return null;
  }
  const { direction, percent } = kpi.delta;
  return (
    <span className={styles[direction]}>
      {fillNodes(text[direction], {
        percent: <bdi key="percent">{formatNumber(percent)}%</bdi>,
      })}
    </span>
  );
}

export interface OverviewKpis {
  readonly created: Kpi;
  readonly paid: Kpi;
  readonly revenue: Kpi;
  readonly awaiting: number;
  readonly currency: string;
}

/**
 * أرقام اليوم في شريط واحد: طلبات اليوم، ما ينتظر الدفع الآن، المدفوع اليوم، وإيراد اليوم. الفرق عن
 * أمس يظهر حين يكون له معنى فقط، والخط الصغير لآخر سبعة أيام. «بانتظار الدفع» رصيد لحظي بلا سلسلة.
 */
export function KpiStrip({
  kpis,
  text,
}: {
  kpis: OverviewKpis;
  text: AdminDictionary["overview"]["kpis"];
}) {
  const revenue = moneyParts(money(kpis.revenue.today, kpis.currency), "ar");
  const spark = (kpi: Kpi) => <Sparkline values={kpi.trend} label={text.trend} />;
  return (
    <ul className={styles.kpis} aria-label={text.label}>
      <KpiCell
        testId="kpi-created"
        label={text.created}
        value={<bdi>{formatNumber(kpis.created.today)}</bdi>}
        note={<DeltaNote kpi={kpis.created} text={text} />}
        spark={spark(kpis.created)}
      />
      <KpiCell
        testId="kpi-awaiting"
        label={text.awaiting}
        value={<bdi>{formatNumber(kpis.awaiting)}</bdi>}
        note={text.awaitingHint}
      />
      <KpiCell
        testId="kpi-paid"
        label={text.paid}
        value={<bdi>{formatNumber(kpis.paid.today)}</bdi>}
        note={<DeltaNote kpi={kpis.paid} text={text} />}
        spark={spark(kpis.paid)}
      />
      <KpiCell
        testId="kpi-revenue"
        label={text.revenue}
        value={
          <>
            <bdi>{revenue.amount}</bdi> <span className={styles.kpiUnit}>{revenue.unit}</span>
          </>
        }
        note={
          kpis.revenue.delta === null ? (
            text.revenueHint
          ) : (
            <DeltaNote kpi={kpis.revenue} text={text} />
          )
        }
        spark={spark(kpis.revenue)}
      />
    </ul>
  );
}
