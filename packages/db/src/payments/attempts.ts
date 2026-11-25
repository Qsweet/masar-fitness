/**
 * إنشاء محاولة الدفع وبدايتها عند المزوّد. استدعاء المزوّد نفسه خارج هذه الطبقة وخارج أي معاملة:
 * هنا يُكتب الصف `created` تحت قفل الطلب، ثم تُكتب نتيجة الاستدعاء (`pending` أو `failed`).
 */
import {
  DomainError,
  err,
  nextAttemptStatus,
  ok,
  paymentDeadline,
  type AttemptFailureReason,
  type ProviderMode,
  type Result,
} from "@masar/domain";
import type { Db } from "../client";
import type { OrderStatus } from "../generated/prisma/client";
import { writeAudit } from "../commerce/audit";
import { inTransaction, type Tx } from "../commerce/transaction";
import { lockAttempt, toAttemptRecord, type PaymentAttemptRecord } from "./records";

export interface CreateAttemptInput {
  readonly orderId: string;
  readonly provider: string;
  readonly providerMode: ProviderMode;
  /** أقل وقت لإكمال الدفع، من الإعداد (لا قيمة له في الكود). */
  readonly minPaymentMinutes: number;
  readonly now: Date;
}

export interface StartedAttempt {
  readonly attempt: PaymentAttemptRecord;
  /** للطلب محاولة حيّة عند المزوّد نفسه فأُرجعت كما هي: الضغطتان محاولة واحدة. */
  readonly reused: boolean;
  readonly orderReference: string;
}

interface LockedOrder {
  id: string;
  club_id: string;
  reference: string;
  status: OrderStatus;
  total_minor: number;
  currency: string;
  expires_at: Date;
}

async function lockOrder(tx: Tx, orderId: string): Promise<LockedOrder | undefined> {
  const rows = await tx.$queryRaw<LockedOrder[]>`
    SELECT id::text AS id, club_id::text AS club_id, reference, status, total_minor, currency, expires_at
    FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`;
  return rows[0];
}

/** المحاولة الحيّة للطلب إن وُجدت. تُقرأ بعد قفل الطلب، فلا تسبقها محاولة متزامنة. */
export async function findLiveAttempt(
  tx: Tx,
  orderId: string,
): Promise<PaymentAttemptRecord | undefined> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT a.id::text AS id FROM payment_attempts a
    WHERE a.order_id = ${orderId}::uuid AND payment_attempt_is_live(a.status, a.settled_at)
    ORDER BY a.created_at DESC LIMIT 1`;
  const id = rows[0]?.id;
  if (id === undefined) {
    return undefined;
  }
  return toAttemptRecord(await tx.paymentAttempt.findUniqueOrThrow({ where: { id } }));
}

async function insertAttempt(
  tx: Tx,
  order: LockedOrder,
  input: CreateAttemptInput,
  deadlineAt: Date,
): Promise<PaymentAttemptRecord> {
  const row = await tx.paymentAttempt.create({
    data: {
      clubId: order.club_id,
      orderId: order.id,
      provider: input.provider,
      providerMode: input.providerMode,
      amountMinor: order.total_minor,
      currency: order.currency,
      deadlineAt,
      createdAt: input.now,
      updatedAt: input.now,
    },
  });
  await writeAudit(tx, {
    clubId: order.club_id,
    entityType: "payment_attempt",
    entityId: row.id,
    action: "payment_attempt_created",
    fromState: null,
    toState: "created",
    actor: "customer",
    data: {
      orderReference: order.reference,
      provider: input.provider,
      providerMode: input.providerMode,
      amountMinor: order.total_minor,
      currency: order.currency,
    },
    at: input.now,
  });
  return toAttemptRecord(row);
}

async function createInTransaction(
  tx: Tx,
  input: CreateAttemptInput,
): Promise<Result<StartedAttempt, DomainError>> {
  const order = await lockOrder(tx, input.orderId);
  if (order === undefined) {
    return err(new DomainError("not_found", "order.not_found"));
  }
  if (order.status !== "pending_payment") {
    return err(new DomainError("conflict", "order.not_payable"));
  }
  const live = await findLiveAttempt(tx, order.id);
  if (live !== undefined) {
    return live.provider === input.provider
      ? ok({ attempt: live, reused: true, orderReference: order.reference })
      : err(new DomainError("conflict", "payment.attempt_in_progress"));
  }
  const deadline = paymentDeadline({
    now: input.now,
    orderExpiresAt: order.expires_at,
    minPaymentMinutes: input.minPaymentMinutes,
  });
  if (!deadline.ok) {
    return deadline;
  }
  const attempt = await insertAttempt(tx, order, input, deadline.value);
  return ok({ attempt, reused: false, orderReference: order.reference });
}

/**
 * ينشئ محاولة دفع `created` لطلب معلّق، تحت قفل الطلب. عديم الأثر عند التكرار: إن كانت للطلب
 * محاولة حيّة عند المزوّد نفسه أُرجعت هي (`reused`)، فلا تُفتح جلستان لطلب واحد.
 * `deadline_at = expires_at − الهامش`، ويُرفض البدء إن لم يبقَ وقت كافٍ (`payment.window_too_short`).
 */
export function createPaymentAttempt(
  db: Db,
  input: CreateAttemptInput,
): Promise<Result<StartedAttempt, DomainError>> {
  return inTransaction(db, (tx) => createInTransaction(tx, input));
}

export interface SessionOpenedInput {
  readonly attemptId: string;
  readonly providerSessionId: string;
  readonly providerStatus: string;
  readonly now: Date;
}

/** المزوّد أنشأ الجلسة: `created → pending` مع معرّفها. يُرفض إن لم تعد المحاولة `created`. */
export function markSessionOpened(
  db: Db,
  input: SessionOpenedInput,
): Promise<Result<PaymentAttemptRecord, DomainError>> {
  return inTransaction(db, async (tx) => {
    const attempt = await lockAttempt(tx, input.attemptId);
    if (attempt === undefined) {
      return err(new DomainError("not_found", "payment_attempt.not_found"));
    }
    const next = nextAttemptStatus(attempt.status, "open_session");
    if (!next.ok) {
      return next;
    }
    const row = await tx.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        status: next.value,
        providerSessionId: input.providerSessionId,
        providerStatus: input.providerStatus,
        pendingAt: input.now,
        updatedAt: input.now,
      },
    });
    await writeAudit(tx, {
      clubId: attempt.clubId,
      entityType: "payment_attempt",
      entityId: attempt.id,
      action: "payment_attempt_session_opened",
      fromState: attempt.status,
      toState: next.value,
      actor: "system",
      data: { provider: attempt.provider, providerSessionId: input.providerSessionId },
      at: input.now,
    });
    return ok(toAttemptRecord(row));
  });
}

export interface StartFailedInput {
  readonly attemptId: string;
  readonly reason: Extract<
    AttemptFailureReason,
    "provider_unreachable" | "provider_rejected" | "start_interrupted"
  >;
  readonly now: Date;
}

/**
 * لم تُنشأ جلسة (انقطاع أو رفض أو توقف العملية): `created → failed`. آمن لأن رابط الدفع لم يصل
 * إلى العميل. يُرفض إن لم تعد المحاولة `created`، فلا يُفشَّل ما فُتحت جلسته.
 */
export function markAttemptStartFailed(
  db: Db,
  input: StartFailedInput,
): Promise<Result<PaymentAttemptRecord, DomainError>> {
  return inTransaction(db, async (tx) => {
    const attempt = await lockAttempt(tx, input.attemptId);
    if (attempt === undefined) {
      return err(new DomainError("not_found", "payment_attempt.not_found"));
    }
    const next = nextAttemptStatus(attempt.status, "fail");
    if (!next.ok || attempt.status !== "created") {
      return err(new DomainError("conflict", "payment_attempt.invalid_transition"));
    }
    const row = await tx.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        status: next.value,
        failureReason: input.reason,
        endedAt: input.now,
        updatedAt: input.now,
      },
    });
    await writeAudit(tx, {
      clubId: attempt.clubId,
      entityType: "payment_attempt",
      entityId: attempt.id,
      action: "payment_attempt_failed",
      fromState: attempt.status,
      toState: next.value,
      actor: "system",
      data: { provider: attempt.provider, reason: input.reason },
      at: input.now,
    });
    return ok(toAttemptRecord(row));
  });
}
