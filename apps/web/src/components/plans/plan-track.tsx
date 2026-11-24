interface PlanTrackProps {
  /** نسبة المدة المدفوعة من أطول باقة (0–100). */
  readonly paidShare: number;
  /** نسبة المدة كاملة مع الأشهر المجانية (0–100). */
  readonly totalShare: number;
}

/**
 * خط المدة: طوله مدة الباقة مقارنة بأطول باقة، فتُقارن الباقات بالنظر.
 * المدفوع بلون داكن، والأشهر المجانية بالكهرماني. زخرفي للقارئ الآلي: المدة مكتوبة نصًا بجانبه.
 */
export function PlanTrack({ paidShare, totalShare }: PlanTrackProps) {
  return (
    <svg
      viewBox="0 0 100 4"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="block h-1.5 w-full rtl:-scale-x-100"
    >
      <rect x="0" y="0" width="100" height="4" className="track-band" />
      <rect x="0" y="0" width={paidShare} height="4" className="track-paid" />
      {totalShare > paidShare ? (
        <rect
          x={paidShare}
          y="0"
          width={totalShare - paidShare}
          height="4"
          className="track-bonus"
        />
      ) : null}
    </svg>
  );
}
