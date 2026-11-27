/**
 * أرقام «نظرة عامة» (ADMIN_REDESIGN §5.1): الفرق عن الفترة السابقة، ونسبة إتمام الدفع، والتجميع الأسبوعي،
 * وأكبر الفئات مع «غيرها»، وقمع الطلب إلى الدفع. أعداد صحيحة فقط: المبالغ بالهللة، والنسب بنقاط الأساس
 * (10000 = 100%)، والفروق بأعشار النسبة، فلا كسر عشري في أي حساب.
 */
const BASIS = 10_000;
/** أعشار النسبة المئوية: 153 = 15.3%. */
const PERCENT_TENTHS = 1_000;
/** نقاط الأساس في عُشر نقطة مئوية. */
const BPS_PER_TENTH_POINT = 10;

export type Direction = "up" | "down";

export interface PercentDelta {
  readonly direction: Direction;
  /** مقدار الفرق بأعشار النسبة المئوية (153 = 15.3%). */
  readonly tenths: number;
}

/**
 * الفرق النسبي عن الفترة السابقة. يُخفى (null) حين السابقة صفر (نسبة من صفر لا معنى لها، القرار
 * 64-8) أو حين لا فرق ظاهرًا بعد التقريب.
 */
export function percentDelta(current: number, previous: number): PercentDelta | null {
  if (previous <= 0 || current === previous) {
    return null;
  }
  const tenths = Math.round((Math.abs(current - previous) * PERCENT_TENTHS) / previous);
  return tenths === 0 ? null : { direction: current > previous ? "up" : "down", tenths };
}

/** نسبة إتمام الدفع بنقاط الأساس: ما دُفع من طلبات الفترة ÷ ما أُنشئ فيها. null بلا طلبات. */
export function completionBps(created: number, paid: number): number | null {
  return created <= 0 ? null : Math.round((Math.min(paid, created) * BASIS) / created);
}

export interface PointsDelta {
  readonly direction: Direction;
  /** مقدار الفرق بأعشار النقطة المئوية (23 = 2.3 نقطة). */
  readonly tenths: number;
}

/** فرق نسبة الإتمام بالنقاط لا بالنسبة؛ يُخفى حين لا نسبة سابقة أو لا فرق. */
export function pointsDelta(current: number | null, previous: number | null): PointsDelta | null {
  if (current === null || previous === null || current === previous) {
    return null;
  }
  const tenths = Math.round(Math.abs(current - previous) / BPS_PER_TENTH_POINT);
  return tenths === 0 ? null : { direction: current > previous ? "up" : "down", tenths };
}

/** أطول سلسلة تُرسم يومية؛ أطول منها تُجمع أسبوعيًا (§5.1). */
export const MAX_DAILY_POINTS = 90;
export const DAYS_PER_WEEK = 7;

/** يجمع قيمًا يومية في مجموعات بحجم ثابت (الأسبوع)، الأقدم أولًا؛ الأخيرة قد تكون أقصر. */
export function bucketSums(values: readonly number[], size: number): number[] {
  const buckets: number[] = [];
  values.forEach((value, index) => {
    const bucket = Math.floor(index / size);
    buckets[bucket] = (buckets[bucket] ?? 0) + value;
  });
  return buckets;
}

export interface Share<T> {
  readonly item: T | null;
  readonly amount: number;
  readonly count: number;
  /** الحصة من المجموع بنقاط الأساس. */
  readonly bps: number;
}

/**
 * أكبر الفئات بالمبلغ، وما زاد على الحد يُجمع في «غيرها» (`item: null`) حتى لا تزيد الفئات على خمس
 * (قاعدة ألوان الرسوم، §3.1).
 */
export function topShares<T>(
  rows: readonly { readonly item: T; readonly amount: number; readonly count: number }[],
  limit: number,
): Share<T>[] {
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  const sorted = [...rows].sort((a, b) => b.amount - a.amount || b.count - a.count);
  const keep = sorted.length > limit + 1 ? sorted.slice(0, limit) : sorted;
  const rest = sorted.slice(keep.length);
  const groups = [
    ...keep.map((row) => ({ item: row.item, amount: row.amount, count: row.count })),
    ...(rest.length === 0
      ? []
      : [
          {
            item: null,
            amount: rest.reduce((sum, row) => sum + row.amount, 0),
            count: rest.reduce((sum, row) => sum + row.count, 0),
          },
        ]),
  ];
  const bps = apportion(
    groups.map((group) => group.amount),
    total,
  );
  return groups.map((group, index) => ({ ...group, bps: bps[index] ?? 0 }));
}

/**
 * حصص بنقاط الأساس مجموعها 10000 بالضبط (طريقة الباقي الأكبر)، فلا تعرض القائمة 99.9% أو 100.1%.
 */
export function apportion(amounts: readonly number[], total: number): number[] {
  if (total <= 0) {
    return amounts.map(() => 0);
  }
  const exact = amounts.map((amount) => (amount * BASIS) / total);
  const floors = exact.map((value) => Math.floor(value));
  let left = BASIS - floors.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, index) => ({ index, rest: value - Math.floor(value) }))
    .sort((a, b) => b.rest - a.rest);
  for (const { index } of order) {
    if (left <= 0) {
      break;
    }
    floors[index] = (floors[index] ?? 0) + 1;
    left -= 1;
  }
  return floors;
}

/** متوسط قيمة الطلب بالهللة (مقرَّب)، أو null بلا طلبات. */
export function averageMinor(totalMinor: number, count: number): number | null {
  return count <= 0 ? null : Math.round(totalMinor / count);
}
