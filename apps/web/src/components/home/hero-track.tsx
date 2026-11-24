/**
 * مسار الشعار: يجري أسفل الواجهة ثم يصعد عند طرفها. نسختان لأن نسبة الشاشة تغيّر الانحناء:
 * الواسعة تصعد حتى أعلى الواجهة، ولا تُستعمل إلا حيث يبقى النص بعيدًا عنها (من 1024 فأعلى).
 */
const PATHS = {
  narrow: "M -40 520 C 330 580, 760 590, 980 480 S 1170 380, 1260 330",
  wide: "M -40 500 C 420 560, 860 530, 1040 310 S 1180 60, 1250 -60",
} as const;

function Track({
  shape,
  className,
}: {
  readonly shape: keyof typeof PATHS;
  readonly className: string;
}) {
  const maskId = `hero-track-${shape}`;
  return (
    <svg
      viewBox="0 0 1200 600"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 size-full rtl:-scale-x-100 ${className}`}
    >
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="-100" y="-100" width="1400" height="800">
          <path d={PATHS[shape]} pathLength="1" className="track-reveal" />
        </mask>
      </defs>
      <path d={PATHS[shape]} className="track-band track-band-wide" />
      <path d={PATHS[shape]} className="track-dash" mask={`url(#${maskId})`} />
    </svg>
  );
}

export function HeroTrack() {
  return (
    <>
      <Track shape="narrow" className="lg:hidden" />
      <Track shape="wide" className="hidden lg:block" />
    </>
  );
}
