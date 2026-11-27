import type { PeriodDay } from "@masar/db";
import {
  bucketSums,
  completionBps,
  DAYS_PER_WEEK,
  MAX_DAILY_POINTS,
  percentDelta,
  pointsDelta,
  type PercentDelta,
  type PointsDelta,
} from "@masar/domain";

/**
 * أرقام الفترة من سلسلتيها اليوميتين (الحالية والسابقة): المجاميع والفروق والخطوط الصغيرة. منطق صرف
 * يُختبر بلا قاعدة؛ القراءة في `period.ts`.
 */
export interface Metric<D> {
  readonly value: number;
  readonly previous: number;
  readonly delta: D | null;
  /** نقاط الخط الصغير: الحالية والسابقة بالطول نفسه، الأقدم أولًا. */
  readonly trend: readonly number[];
  readonly compare: readonly number[];
}

export interface PeriodSummary {
  readonly revenue: Metric<PercentDelta>;
  readonly paid: Metric<PercentDelta>;
  /** نسبة الإتمام بنقاط الأساس، أو null بلا طلبات في الفترة. */
  readonly completion: Omit<Metric<PointsDelta>, "value" | "previous"> & {
    readonly value: number | null;
    readonly previous: number | null;
  };
  readonly created: number;
  /** أعمدة الإيراد: يومية حتى 90 يومًا، وأسبوعية بعدها. */
  readonly bars: { readonly unit: "day" | "week"; readonly values: readonly number[] };
  readonly compareBars: readonly number[];
}

function sum(days: readonly PeriodDay[], pick: (day: PeriodDay) => number): number {
  return days.reduce((total, day) => total + pick(day), 0);
}

function metric(
  current: readonly PeriodDay[],
  previous: readonly PeriodDay[],
  pick: (day: PeriodDay) => number,
): Metric<PercentDelta> {
  const value = sum(current, pick);
  const before = sum(previous, pick);
  return {
    value,
    previous: before,
    delta: percentDelta(value, before),
    trend: current.map(pick),
    compare: previous.map(pick),
  };
}

const dailyCompletion = (day: PeriodDay) => completionBps(day.created, day.createdPaid) ?? 0;

function bars(days: readonly PeriodDay[]): readonly number[] {
  const values = days.map((day) => day.revenueMinor);
  return days.length > MAX_DAILY_POINTS ? bucketSums(values, DAYS_PER_WEEK) : values;
}

export function periodSummary(
  current: readonly PeriodDay[],
  previous: readonly PeriodDay[],
): PeriodSummary {
  const completion = completionBps(
    sum(current, (day) => day.created),
    sum(current, (day) => day.createdPaid),
  );
  const previousCompletion = completionBps(
    sum(previous, (day) => day.created),
    sum(previous, (day) => day.createdPaid),
  );
  return {
    revenue: metric(current, previous, (day) => day.revenueMinor),
    paid: metric(current, previous, (day) => day.paid),
    completion: {
      value: completion,
      previous: previousCompletion,
      delta: pointsDelta(completion, previousCompletion),
      trend: current.map(dailyCompletion),
      compare: previous.map(dailyCompletion),
    },
    created: sum(current, (day) => day.created),
    bars: { unit: current.length > MAX_DAILY_POINTS ? "week" : "day", values: bars(current) },
    compareBars: bars(previous),
  };
}
