import type { Direction, PercentDelta } from "@masar/domain";
import type { AdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { formatNumber } from "@/i18n/format";
import { cx } from "@/lib/cx";
import { AdminIcon } from "../admin-icon";
import styles from "./overview.module.css";

type KpiText = AdminDictionary["overview"]["kpis"];

const TENTHS = 10;

/** أعشار بلا كسر عشري في الحساب: 153 ← «15.3». */
export function formatTenths(tenths: number): string {
  return `${formatNumber(Math.floor(tenths / TENTHS))}.${String(tenths % TENTHS)}`;
}

/** نسبة مئوية من أعشارها: 153 ← «15.3%». */
export function formatPercentTenths(tenths: number): string {
  return `${formatTenths(tenths)}%`;
}

interface DeltaBadgeProps {
  readonly direction: Direction;
  /** المقدار كما يُعرض («15.3%» أو «2.3 نقطة»). */
  readonly value: string;
  readonly text: KpiText;
}

/**
 * شارة الفرق: سهم ولون والمقدار، والجملة كاملة لقارئ الشاشة («أعلى من الفترة السابقة بـ15.3%»). اللون
 * لا يحمل المعنى وحده (WCAG 1.4.1): السهم والجملة معه.
 */
export function DeltaBadge({ direction, value, text }: DeltaBadgeProps) {
  return (
    <span className={cx(styles.delta, direction === "up" ? styles.deltaUp : styles.deltaDown)}>
      <AdminIcon name={direction} size={12} />
      <bdi aria-hidden="true">{value}</bdi>
      <span className="sr-only">{fill(text[direction], { value })}</span>
    </span>
  );
}

/** شارة فرق نسبي، ولا شيء حين يُخفى الفرق. */
export function DeltaFor({ delta, text }: { delta: PercentDelta | null; text: KpiText }) {
  return delta === null ? null : (
    <DeltaBadge direction={delta.direction} value={formatPercentTenths(delta.tenths)} text={text} />
  );
}
