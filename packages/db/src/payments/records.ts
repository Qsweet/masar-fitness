/** صف محاولة الدفع كما تتعامل معه بقية الطبقات: بلا أنواع Prisma، والبيئة نوع مغلق. */
import {
  DomainError,
  PROVIDER_MODES,
  type AttemptFacts,
  type AttemptStatus,
  type ProviderMode,
} from "@masar/domain";
import type { PaymentAttempt } from "../generated/prisma/client";
import type { Tx } from "../commerce/transaction";

export interface PaymentAttemptRecord {
  readonly id: string;
  readonly clubId: string;
  readonly orderId: string;
  readonly provider: string;
  readonly providerMode: ProviderMode;
  readonly status: AttemptStatus;
  readonly amountMinor: number;
  readonly currency: string;
  readonly providerSessionId: string | null;
  readonly providerPaymentId: string | null;
  readonly providerStatus: string | null;
  readonly deadlineAt: Date;
  readonly settledAt: Date | null;
  readonly settlementResult: string | null;
  readonly failureReason: string | null;
  readonly lastCheckedAt: Date | null;
  readonly checkCount: number;
  readonly createdAt: Date;
}

/** CHECK القاعدة يحصر البيئة في test و live. */
function toProviderMode(value: string): ProviderMode {
  const mode = PROVIDER_MODES.find((known) => known === value);
  if (mode === undefined) {
    throw new DomainError("invariant", "payment_attempt.unknown_provider_mode");
  }
  return mode;
}

export function toAttemptRecord(row: PaymentAttempt): PaymentAttemptRecord {
  return {
    id: row.id,
    clubId: row.clubId,
    orderId: row.orderId,
    provider: row.provider,
    providerMode: toProviderMode(row.providerMode),
    status: row.status,
    amountMinor: row.amountMinor,
    currency: row.currency,
    providerSessionId: row.providerSessionId,
    providerPaymentId: row.providerPaymentId,
    providerStatus: row.providerStatus,
    deadlineAt: row.deadlineAt,
    settledAt: row.settledAt,
    settlementResult: row.settlementResult,
    failureReason: row.failureReason,
    lastCheckedAt: row.lastCheckedAt,
    checkCount: row.checkCount,
    createdAt: row.createdAt,
  };
}

export function toAttemptFacts(record: PaymentAttemptRecord): AttemptFacts {
  return {
    id: record.id,
    status: record.status,
    settled: record.settledAt !== null,
    provider: record.provider,
    providerMode: record.providerMode,
    providerSessionId: record.providerSessionId,
    providerPaymentId: record.providerPaymentId,
    deadlineAt: record.deadlineAt,
  };
}

/** يقفل صف المحاولة FOR UPDATE ويرجعه، أو undefined إن لم يوجد. لا قفل على الطلب هنا. */
export async function lockAttempt(
  tx: Tx,
  attemptId: string,
): Promise<PaymentAttemptRecord | undefined> {
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT id::text AS id FROM payment_attempts WHERE id = ${attemptId}::uuid FOR UPDATE`;
  if (locked.length === 0) {
    return undefined;
  }
  const row = await tx.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId } });
  return toAttemptRecord(row);
}
