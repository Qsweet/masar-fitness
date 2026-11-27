import { barChart, niceAxisMax, sparklinePoints, type BarChart } from "../overview-view";

/**
 * هندسة رسوم «نظرة عامة» v2 (ADMIN_REDESIGN §5.1): الفترة الحالية والسابقة على مقياس واحد، والزمن
 * يجري مع القراءة: الأقدم في جهة البداية (يمينًا في العربية)، فالمكوّن يرسم في SVG باتجاه LTR ويعكس
 * الترتيب هنا. منطق صرف يُختبر بلا متصفح.
 */
const COORDINATE_DIGITS = 2;
const round = (value: number) => Number(value.toFixed(COORDINATE_DIGITS));

export interface RevenueChart extends BarChart {
  /** نقاط خط الفترة السابقة فوق منتصف كل خانة، بالترتيب نفسه، أو فارغ بلا سابقة. */
  readonly compare: string;
  /** فهارس الأعمدة التي يُكتب تحتها تاريخها: الأقدم والأوسط والأحدث. */
  readonly labelled: readonly number[];
}

export interface ChartArea {
  readonly width: number;
  readonly height: number;
  readonly gapRatio: number;
}

/** يعكس الترتيب ليقع الأقدم في جهة البداية بالعربية (يمين اللوحة). */
export function readingOrder<T>(values: readonly T[]): T[] {
  return [...values].reverse();
}

export function revenueChart(
  values: readonly number[],
  compare: readonly number[],
  box: ChartArea,
): RevenueChart {
  const max = niceAxisMax(Math.max(0, ...values, ...compare));
  const chart = barChart(readingOrder(values), box, max);
  const slot = values.length === 0 ? 0 : box.width / values.length;
  const points = readingOrder(compare.slice(0, values.length)).map((value, index) => {
    const x = round(index * slot + slot / 2);
    const y = round(box.height - (value / max) * box.height);
    return `${String(x)},${String(y)}`;
  });
  const last = values.length - 1;
  const labelled = last < 0 ? [] : [...new Set([0, Math.floor(last / 2), last])];
  return { ...chart, compare: compare.length === 0 ? "" : points.join(" "), labelled };
}

export interface Sparkline {
  readonly line: string;
  readonly area: string;
  readonly compare: string;
}

/** الخط الصغير للمؤشر وخط الفترة السابقة متقطعًا، على مقياس مشترك، ومساحة تحت الحالي. */
export function sparkline(
  trend: readonly number[],
  compare: readonly number[],
  width: number,
  height: number,
): Sparkline {
  const scale = { min: 0, max: Math.max(0, ...trend, ...compare) };
  const line = sparklinePoints(readingOrder(trend), width, height, scale);
  const first = line.split(" ")[0]?.split(",")[0] ?? "0";
  const last = line.split(" ").at(-1)?.split(",")[0] ?? "0";
  return {
    line,
    area: line === "" ? "" : `${first},${String(height)} ${line} ${last},${String(height)}`,
    compare:
      compare.length === 0 ? "" : sparklinePoints(readingOrder(compare), width, height, scale),
  };
}
