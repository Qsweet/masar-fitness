import { barChart, niceAxisMax, type BarChart } from "../overview-view";

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
  /** مسار SVG (`d`) للحالية، مقطوعًا عند الأيام بلا قيمة. */
  readonly line: string;
  /** المساحة تحت الحالية، حين لا فجوة فيها؛ وإلا فارغ. */
  readonly area: string;
  readonly compare: string;
}

const PAD = 2;

type Point = readonly [number, number] | null;

function points(
  values: readonly (number | null)[],
  width: number,
  height: number,
  max: number,
): Point[] {
  const step = values.length > 1 ? (width - 2 * PAD) / (values.length - 1) : 0;
  return readingOrder(values).map((value, index) =>
    value === null
      ? null
      : [
          round(PAD + index * step),
          round(height - PAD - (max === 0 ? 0 : value / max) * (height - 2 * PAD)),
        ],
  );
}

/**
 * مسار يقفز فوق الفجوات: كل مقطع متصل يبدأ بـM. نقطة وحيدة بين فجوتين مقطع صفري الطول يُرى نقطةً بطرف
 * الخط المدوّر.
 */
function path(line: readonly Point[]): string {
  const segments: (readonly [number, number])[][] = [];
  let current: (readonly [number, number])[] = [];
  for (const point of [...line, null]) {
    if (point === null) {
      if (current.length > 0) {
        segments.push(current);
      }
      current = [];
    } else {
      current.push(point);
    }
  }
  return segments
    .map((segment) => {
      const drawn = segment.length === 1 ? [segment[0], segment[0]] : segment;
      return drawn
        .map((p, i) => `${i === 0 ? "M" : "L"}${String(p?.[0])},${String(p?.[1])}`)
        .join(" ");
    })
    .join(" ");
}

/**
 * الخط الصغير للمؤشر وخط الفترة السابقة متقطعًا، على مقياس مشترك يبدأ من الصفر. يوم بلا قيمة (null:
 * نسبة إتمام بلا طلبات) فجوة لا صفر، فلا يُرسم هبوط لم يحدث.
 */
export function sparkline(
  trend: readonly (number | null)[],
  compare: readonly (number | null)[],
  width: number,
  height: number,
): Sparkline {
  const known = [...trend, ...compare].filter((value): value is number => value !== null);
  const max = Math.max(0, ...known);
  const line = points(trend, width, height, max);
  const first = line[0];
  const last = line.at(-1);
  const gapless = line.length > 0 && line.every((point) => point !== null);
  return {
    line: path(line),
    area:
      gapless && first !== null && first !== undefined && last !== null && last !== undefined
        ? `M${String(first[0])},${String(height)} ${path(line).replace(/^M/, "L")} L${String(last[0])},${String(height)} Z`
        : "",
    compare: path(points(compare, width, height, max)),
  };
}
