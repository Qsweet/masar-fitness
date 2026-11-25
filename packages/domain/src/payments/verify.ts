/**
 * قرار التحقق (الشرط الصلب 3): ماذا نفعل بمحاولتنا بعد قراءة جلستها من المزوّد نفسه؟
 * خالص: لا شبكة ولا قاعدة. المبلغ والعملة لا يُقارنان بالطلب هنا: يمرّان خامَين إلى
 * `markOrderPaid`، وهي المكان الوحيد للمقارنة (`decideSettlement`)، فلا يُخفى فرق عن القاعدة.
 */
import type { VerifiedPayment } from "../commerce/lifecycle/settlement";
import { isLiveAttempt, type AttemptEvent } from "./attempt-state";
import type { IncidentNote } from "./incident";
import type {
  AttemptFacts,
  ProviderPaymentSnapshot,
  ProviderPaymentState,
  ProviderSessionSnapshot,
} from "./snapshot";

/** سبب فشل المحاولة: رمز آلي، لا نص من المزوّد. */
export const ATTEMPT_FAILURE_REASONS = [
  "provider_unreachable",
  "provider_rejected",
  "start_interrupted",
  "payment_failed",
] as const;

export type AttemptFailureReason = (typeof ATTEMPT_FAILURE_REASONS)[number];

export interface VerificationContext {
  readonly now: Date;
  /** بعد كم من `deadline_at` تُفتح حادثة `stuck_pending` لمحاولة ما زالت حيّة. */
  readonly stuckAlertAfterMs: number;
}

export type VerificationDecision =
  /** دفعة مدفوعة ومطابقة المراجع: تُمرَّر إلى `markOrderPaid` بقيمها الخام. */
  | {
      readonly action: "settle";
      readonly event: AttemptEvent | null;
      readonly payment: VerifiedPayment;
      readonly method: string | null;
      readonly incidents: readonly IncidentNote[];
    }
  /** لا تسوية: تتقدم الحالة (أو تبقى) وتُسجَّل الحوادث إن وُجدت. */
  | {
      readonly action: "update";
      readonly event: AttemptEvent | null;
      readonly failureReason: AttemptFailureReason | null;
      readonly incidents: readonly IncidentNote[];
    }
  /** اللقطة لا تخص محاولتنا أو مبلغها ليس هللات صحيحة: لا يُطبَّق منها شيء. */
  | { readonly action: "incident"; readonly incidents: readonly IncidentNote[] }
  | { readonly action: "ignore"; readonly reason: "no_session" | "settled" | "attempt_closed" };

const IN_FLIGHT: readonly ProviderPaymentState[] = ["in_progress", "indeterminate"];
const REVERSED: readonly ProviderPaymentState[] = ["voided", "refunded"];

/** أول مرجع لا يطابق محاولتنا، أو null إن طابقت كلها. */
function referenceProblem(attempt: AttemptFacts, snapshot: ProviderSessionSnapshot): string | null {
  if (snapshot.provider !== attempt.provider) {
    return "provider_mismatch";
  }
  if (snapshot.sessionId !== attempt.providerSessionId) {
    return "session_mismatch";
  }
  if (snapshot.attemptId !== attempt.id) {
    return "attempt_mismatch";
  }
  if (snapshot.mode !== attempt.providerMode) {
    return "mode_mismatch";
  }
  const foreign = snapshot.payments.some((payment) => payment.sessionId !== snapshot.sessionId);
  return foreign ? "payment_session_mismatch" : null;
}

function paymentData(payment: ProviderPaymentSnapshot): IncidentNote["data"] {
  return {
    providerPaymentId: payment.paymentId,
    providerStatus: payment.rawStatus,
    amountMinor: payment.amountMinor,
    currency: payment.currency,
  };
}

/** هللات صحيحة موجبة فقط: لا كسر ولا NaN ولا صيغة أسية تصل إلى التسوية. */
function isMinorAmount(amountMinor: number): boolean {
  return Number.isSafeInteger(amountMinor) && amountMinor > 0;
}

function settle(
  attempt: AttemptFacts,
  snapshot: ProviderSessionSnapshot,
  paid: readonly ProviderPaymentSnapshot[],
  chosen: ProviderPaymentSnapshot,
): VerificationDecision {
  if (!isMinorAmount(chosen.amountMinor)) {
    const data = { providerPaymentId: chosen.paymentId, reason: "amount_not_minor_integer" };
    return { action: "incident", incidents: [{ kind: "amount_mismatch", data }] };
  }
  const incidents: IncidentNote[] = [];
  if (chosen.couponApplied) {
    incidents.push({ kind: "coupon_applied_by_provider", data: paymentData(chosen) });
  }
  const extra = paid.find((payment) => payment.paymentId !== chosen.paymentId);
  if (extra !== undefined) {
    incidents.push({ kind: "order_already_paid", data: paymentData(extra) });
  }
  const advances = attempt.status === "pending" || attempt.status === "authorized";
  return {
    action: "settle",
    event: advances ? "capture" : null,
    payment: {
      provider: snapshot.provider,
      providerPaymentId: chosen.paymentId,
      amountMinor: chosen.amountMinor,
      currency: chosen.currency,
    },
    method: chosen.method,
    incidents,
  };
}

/** محاولة سُجّلت تسويتها: لا يُعاد شيء، ويُكشف العكس اللاحق أو دفعة ثانية على الجلسة نفسها. */
function decideSettled(
  attempt: AttemptFacts,
  snapshot: ProviderSessionSnapshot,
): VerificationDecision {
  const own = snapshot.payments.find((payment) => payment.paymentId === attempt.providerPaymentId);
  const incidents: IncidentNote[] = [];
  if (own !== undefined && REVERSED.includes(own.state)) {
    incidents.push({ kind: "provider_reversed", data: paymentData(own) });
  }
  const extra = snapshot.payments.find(
    (payment) => payment.state === "paid" && payment.paymentId !== attempt.providerPaymentId,
  );
  if (extra !== undefined) {
    incidents.push({ kind: "order_already_paid", data: paymentData(extra) });
  }
  if (incidents.length === 0) {
    return { action: "ignore", reason: "settled" };
  }
  const voided = own?.state === "voided" && attempt.status === "captured";
  return { action: "update", event: voided ? "void" : null, failureReason: null, incidents };
}

function stuckIncidents(
  attempt: AttemptFacts,
  snapshot: ProviderSessionSnapshot,
  context: VerificationContext,
): IncidentNote[] {
  const alertAt = attempt.deadlineAt.getTime() + context.stuckAlertAfterMs;
  if (context.now.getTime() < alertAt) {
    return [];
  }
  const data = { providerStatus: snapshot.rawStatus, deadlineAt: attempt.deadlineAt.toISOString() };
  return [{ kind: "stuck_pending", data }];
}

/** لا دفعة مدفوعة: هل ما زال الدفع ممكنًا أو جاريًا، أم انتهت الجلسة بلا مال؟ */
function decideUnpaid(
  attempt: AttemptFacts,
  snapshot: ProviderSessionSnapshot,
  context: VerificationContext,
): VerificationDecision {
  const { payments } = snapshot;
  const reversed = payments.find((payment) => REVERSED.includes(payment.state));
  if (attempt.status === "captured" && reversed !== undefined) {
    const incidents: IncidentNote[] = [{ kind: "provider_reversed", data: paymentData(reversed) }];
    return { action: "update", event: "void", failureReason: null, incidents };
  }
  if (attempt.status === "pending" && payments.some((payment) => payment.state === "authorized")) {
    return { action: "update", event: "authorize", failureReason: null, incidents: [] };
  }
  const inFlight = payments.some((payment) => IN_FLIGHT.includes(payment.state));
  if (attempt.status !== "pending" || inFlight || snapshot.state !== "closed") {
    const incidents = stuckIncidents(attempt, snapshot, context);
    return { action: "update", event: null, failureReason: null, incidents };
  }
  if (payments.length > 0) {
    return { action: "update", event: "fail", failureReason: "payment_failed", incidents: [] };
  }
  return { action: "update", event: "expire", failureReason: null, incidents: [] };
}

/**
 * يقرر مصير المحاولة من لقطة المزوّد. الترتيب: المراجع أولًا (جلسة، محاولة، بيئة، دفعات الجلسة)،
 * ثم المحاولة المسوّاة، ثم الدفعة المدفوعة (ولو كانت المحاولة نهائية: المال الذي وصل لا يُهمل،
 * و`markOrderPaid` تحسم قابلية الطلب)، ثم غير المدفوع.
 */
export function decideVerification(
  attempt: AttemptFacts,
  snapshot: ProviderSessionSnapshot,
  context: VerificationContext,
): VerificationDecision {
  if (attempt.providerSessionId === null) {
    return { action: "ignore", reason: "no_session" };
  }
  const problem = referenceProblem(attempt, snapshot);
  if (problem !== null) {
    const data = { reason: problem, providerSessionId: snapshot.sessionId };
    return { action: "incident", incidents: [{ kind: "unknown_reference", data }] };
  }
  if (attempt.settled) {
    return decideSettled(attempt, snapshot);
  }
  const paid = snapshot.payments.filter((payment) => payment.state === "paid");
  const chosen = paid.find((payment) => payment.paymentId === attempt.providerPaymentId) ?? paid[0];
  if (chosen !== undefined) {
    return settle(attempt, snapshot, paid, chosen);
  }
  if (!isLiveAttempt(attempt.status, attempt.settled)) {
    return { action: "ignore", reason: "attempt_closed" };
  }
  return decideUnpaid(attempt, snapshot, context);
}
