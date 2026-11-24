interface PlanTrackProps {
  /** نسبة المدة المدفوعة من أطول باقة (0–100). */
  readonly paidShare: number;
  /** نسبة المدة كاملة مع الأشهر المجانية (0–100). */
  readonly totalShare: number;
}

/**
 * «المضمار»: طول الخط هو مدة الباقة. المدفوع كهرماني، والمجاني بلون الطباشير، وخط النهاية عمودي.
 * زخرفي للقارئ الآلي: المدة مكتوبة نصًا بجانبه.
 */
export function PlanTrack({ paidShare, totalShare }: PlanTrackProps) {
  return (
    <svg
      viewBox="0 0 100 10"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="block h-3 w-full overflow-visible rtl:-scale-x-100"
    >
      <line x1="0" y1="5" x2={totalShare} y2="5" className="track-band track-band-slim" />
      <line x1="0" y1="5" x2={paidShare} y2="5" className="track-dash" />
      {totalShare > paidShare ? (
        <line
          x1={paidShare}
          y1="5"
          x2={totalShare}
          y2="5"
          className="track-dash track-dash-bonus"
        />
      ) : null}
      <line x1={totalShare} y1="-2" x2={totalShare} y2="12" className="track-finish" />
    </svg>
  );
}
