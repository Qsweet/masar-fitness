/**
 * من الطلب إلى الدفع (ADMIN_REDESIGN §5.1): ثلاث خطوات حقيقية من القاعدة لطلبات أُنشئت في الفترة،
 * وسبب الفقد بين كل خطوتين. الزائر قبل الطلب يحتاج التحليلات (A5) فلا يظهر هنا.
 */
export interface FunnelCounts {
  readonly created: number;
  /** بدأت لها محاولة دفع (أو دُفعت يدويًا بلا محاولة). */
  readonly attempted: number;
  readonly paid: number;
  /** لم تُدفع وفشلت إحدى محاولاتها. */
  readonly failed: number;
  /** لم تُدفع وبلغت مهلتها بعد بدء الدفع بلا محاولة فاشلة. */
  readonly expired: number;
}

const BASIS = 10_000;

export interface FunnelStep {
  readonly key: "created" | "attempted" | "paid";
  readonly count: number;
  /** من الخطوة الأولى بنقاط الأساس. */
  readonly bps: number;
}

export interface FunnelDrop {
  /** فاقد بين هذه الخطوة والتي قبلها. */
  readonly lost: number;
  /** من الخطوة السابقة بنقاط الأساس. */
  readonly bps: number;
  /** أسباب الفقد بعد بدء الدفع (الخطوة الثالثة وحدها). */
  readonly failed: number;
  readonly expired: number;
  readonly other: number;
}

export interface Funnel {
  readonly steps: readonly [FunnelStep, FunnelStep, FunnelStep];
  readonly drops: readonly [FunnelDrop, FunnelDrop];
}

function share(part: number, whole: number): number {
  return whole <= 0 ? 0 : Math.round((part * BASIS) / whole);
}

/** يضبط الأعداد لتتناقص (لا خطوة تزيد على سابقتها) ثم يحسب الحصص والفاقد. */
export function orderFunnel(counts: FunnelCounts): Funnel {
  const created = Math.max(0, counts.created);
  const attempted = Math.min(Math.max(0, counts.attempted), created);
  const paid = Math.min(Math.max(0, counts.paid), attempted);
  const lostLate = attempted - paid;
  const failed = Math.min(Math.max(0, counts.failed), lostLate);
  const expired = Math.min(Math.max(0, counts.expired), lostLate - failed);
  return {
    steps: [
      { key: "created", count: created, bps: created === 0 ? 0 : BASIS },
      { key: "attempted", count: attempted, bps: share(attempted, created) },
      { key: "paid", count: paid, bps: share(paid, created) },
    ],
    drops: [
      {
        lost: created - attempted,
        bps: share(created - attempted, created),
        failed: 0,
        expired: 0,
        other: created - attempted,
      },
      {
        lost: lostLate,
        bps: share(lostLate, attempted),
        failed,
        expired,
        other: lostLate - failed - expired,
      },
    ],
  };
}
