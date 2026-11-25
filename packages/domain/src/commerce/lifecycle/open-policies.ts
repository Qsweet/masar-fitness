/**
 * سياسات لم يحسمها المالك بعد وتحجب انتقالات في آلات الحالة.
 * الانتقال المحجوب يرجع دائمًا `policy.undecided.<policy>` ولا يفترض قيمة.
 */
export const OPEN_POLICIES = [
  "freeze_rules",
  "cancellation_rules",
  "refund_eligibility",
  "renewal_start",
] as const;

export type OpenPolicy = (typeof OPEN_POLICIES)[number];
