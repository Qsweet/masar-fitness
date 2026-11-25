/** خطة تطبيق قرار التحقق على صف المحاولة: ما يتغير من أعمدتها وما يُفتح من حوادث. */
import {
  DomainError,
  nextAttemptStatus,
  type AttemptEvent,
  type AttemptFailureReason,
  type AttemptStatus,
  type IncidentNote,
  type ProviderSessionSnapshot,
  type VerificationDecision,
  type VerifiedPayment,
} from "@masar/domain";
import type { Prisma } from "../generated/prisma/client";
import type { Tx } from "../commerce/transaction";
import type { PaymentAttemptRecord } from "./records";

export interface ObservedInput {
  readonly snapshot: ProviderSessionSnapshot;
  readonly now: Date;
}

export interface Plan {
  readonly event: AttemptEvent | null;
  readonly failureReason: AttemptFailureReason | null;
  readonly payment: VerifiedPayment | null;
  readonly method: string | null;
  readonly notes: readonly IncidentNote[];
  /** اللقطة تخص محاولتنا، فتُحفظ حالتها الخام. */
  readonly trusted: boolean;
}

const NO_CHANGE: Plan = {
  event: null,
  failureReason: null,
  payment: null,
  method: null,
  notes: [],
  trusted: false,
};

export function toPlan(decision: VerificationDecision): Plan {
  switch (decision.action) {
    case "settle":
      return {
        event: decision.event,
        failureReason: null,
        payment: decision.payment,
        method: decision.method,
        notes: decision.incidents,
        trusted: true,
      };
    case "update":
      return {
        ...NO_CHANGE,
        event: decision.event,
        failureReason: decision.failureReason,
        notes: decision.incidents,
        trusted: true,
      };
    case "incident":
      return { ...NO_CHANGE, notes: decision.incidents };
    case "ignore":
      return { ...NO_CHANGE, trusted: decision.reason !== "no_session" };
  }
}

/**
 * الدفعة نفسها مربوطة بمحاولة أخرى (`UNIQUE(provider, provider_payment_id)`): لا تسوية ولا انتقال،
 * وحادثة `payment_already_used`. دفعة المزوّد تسوّي طلبًا واحدًا فقط.
 */
export async function rejectReusedPayment(
  tx: Tx,
  attempt: PaymentAttemptRecord,
  plan: Plan,
): Promise<Plan> {
  const { payment } = plan;
  if (payment === null || attempt.providerPaymentId === payment.providerPaymentId) {
    return plan;
  }
  const other = await tx.paymentAttempt.findFirst({
    where: {
      provider: attempt.provider,
      providerPaymentId: payment.providerPaymentId,
      id: { not: attempt.id },
    },
    select: { id: true },
  });
  if (other === null) {
    return plan;
  }
  const note: IncidentNote = {
    kind: "payment_already_used",
    data: { providerPaymentId: payment.providerPaymentId, amountMinor: payment.amountMinor },
  };
  return { ...NO_CHANGE, trusted: true, notes: [...plan.notes, note] };
}

export function nextStatus(
  attempt: PaymentAttemptRecord,
  event: AttemptEvent | null,
): AttemptStatus {
  if (event === null) {
    return attempt.status;
  }
  const next = nextAttemptStatus(attempt.status, event);
  if (!next.ok) {
    throw new DomainError("invariant", "payment_attempt.unexpected_transition", {
      cause: next.error,
    });
  }
  return next.value;
}

const TERMINAL: readonly AttemptStatus[] = ["failed", "voided", "expired", "refunded"];

function transitionTimes(status: AttemptStatus, now: Date): Prisma.PaymentAttemptUpdateInput {
  if (TERMINAL.includes(status)) {
    return { endedAt: now };
  }
  if (status === "authorized") {
    return { authorizedAt: now };
  }
  return status === "captured" ? { capturedAt: now } : {};
}

export function observedData(
  attempt: PaymentAttemptRecord,
  plan: Plan,
  status: AttemptStatus,
  input: ObservedInput,
): Prisma.PaymentAttemptUpdateInput {
  const { now } = input;
  const data: Prisma.PaymentAttemptUpdateInput = {
    lastCheckedAt: now,
    checkCount: { increment: 1 },
    syncLeaseUntil: null,
    updatedAt: now,
  };
  if (plan.trusted) {
    data.providerStatus = input.snapshot.rawStatus;
  }
  if (plan.payment !== null && attempt.providerPaymentId === null) {
    data.providerPaymentId = plan.payment.providerPaymentId;
  }
  if (plan.method !== null) {
    data.method = plan.method;
  }
  if (status === attempt.status) {
    return data;
  }
  return { ...data, ...transitionTimes(status, now), status, failureReason: plan.failureReason };
}
