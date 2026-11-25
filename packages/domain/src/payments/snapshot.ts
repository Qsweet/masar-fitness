import type { AttemptStatus } from "./attempt-state";

/** بيئة المزوّد التي أُنشئت فيها المحاولة. لا تختلط التجربة بالحي. */
export const PROVIDER_MODES = ["test", "live"] as const;
export type ProviderMode = (typeof PROVIDER_MODES)[number];

/**
 * هل تقبل جلسة المزوّد (فاتورة، جلسة تقسيط) دفعًا بعد؟ `indeterminate`: حالة موثقة لم يُتحقق من
 * معناها في البيئة التجريبية، فلا تُنهى بها المحاولة ولا تُخمَّن.
 */
export type ProviderSessionState = "open" | "closed" | "indeterminate";

/** حالة دفعة عند المزوّد بلغة محايدة. `indeterminate` كما في الجلسة: لا تُحسم بها المحاولة. */
export type ProviderPaymentState =
  | "in_progress"
  | "paid"
  | "authorized"
  | "failed"
  | "voided"
  | "refunded"
  | "indeterminate";

/** دفعة قُرئت من المزوّد بالمفتاح السري، بقيمها الخام. المبلغ عدد صحيح بالهللة كما وصل. */
export interface ProviderPaymentSnapshot {
  readonly paymentId: string;
  readonly state: ProviderPaymentState;
  readonly rawStatus: string;
  readonly amountMinor: number;
  readonly currency: string;
  /** الجلسة التي يقول المزوّد إن الدفعة لها، أو null إن لم يذكر. */
  readonly sessionId: string | null;
  /** وسيلة الدفع كما يسميها المزوّد (رمز آلي، لا بيانات بطاقة). */
  readonly method: string | null;
  /** المزوّد طبّق خصمًا من عنده فنقص المبلغ المحصَّل. */
  readonly couponApplied: boolean;
}

/** جلسة قُرئت من المزوّد ومعها كل دفعاتها. لا شيء فيها من جسم إشعار أو رابط عودة. */
export interface ProviderSessionSnapshot {
  readonly provider: string;
  readonly sessionId: string;
  readonly mode: ProviderMode;
  readonly state: ProviderSessionState;
  readonly rawStatus: string;
  /** معرّف محاولتنا كما حفظه المزوّد في بيانات الجلسة، أو null إن غاب. */
  readonly attemptId: string | null;
  readonly payments: readonly ProviderPaymentSnapshot[];
}

/** ما يلزم من صف المحاولة لقرار التحقق. */
export interface AttemptFacts {
  readonly id: string;
  readonly status: AttemptStatus;
  /** سُجّلت نتيجة `markOrderPaid` لهذه المحاولة. */
  readonly settled: boolean;
  readonly provider: string;
  readonly providerMode: ProviderMode;
  readonly providerSessionId: string | null;
  readonly providerPaymentId: string | null;
  readonly deadlineAt: Date;
}
