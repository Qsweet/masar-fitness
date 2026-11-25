/**
 * تسجيل دفعة متحقق منها على طلب: نقطة تسليم المرحلة 4. لا استدعاء خارجي داخل المعاملة.
 *
 * شرطان صلبان على المرحلة 4 قبل أي دفع حي (يمنعان أن تصل دفعة لطلب أنهته المهلة):
 * 1. تنتهي جلسة المزوّد أو رابط الدفع قبل `orders.expires_at` بهامش.
 * 2. يستثني `expireDueOrders` كل طلب له محاولة دفع `pending` أو `authorized`.
 * إن وصلت دفعة مع ذلك فالنتيجة `order.not_payable` مع سطر تدقيق كامل، ومعالجتها قرار المالك.
 */
import {
  DomainError,
  decideSettlement,
  err,
  money,
  ok,
  type Result,
  type VerifiedPayment,
} from "@masar/domain";
import type { Db } from "../client";
import type { OrderStatus } from "../generated/prisma/client";
import { writeAudit, type AuditActor } from "./audit";
import { createMembershipForOrder } from "./membership-write";
import { mapCommerceDbError } from "./sql-errors";
import { inTransaction, type Tx } from "./transaction";

export interface MarkOrderPaidInput {
  readonly orderId: string;
  readonly payment: VerifiedPayment;
  readonly actor: Extract<AuditActor, "provider" | "system">;
  readonly now: Date;
}

/**
 * حالات الطلب الذي سُجّلت دفعته. حالتا الاسترداد تظهران في الإعادة فقط: دفعة مسجّلة يعيد المزوّد
 * إرسالها بعد استرداد جزئي أو كلي ترجع حالتها الفعلية، لا عطلًا يجعل المزوّد يكرر المحاولة.
 */
const SETTLED_STATUSES = ["paid", "fulfilled", "partially_refunded", "refunded"] as const;

export type SettledOrderStatus = (typeof SETTLED_STATUSES)[number];

export interface PaidOrder {
  readonly orderId: string;
  readonly reference: string;
  readonly status: SettledOrderStatus;
  readonly membershipId: string | null;
  readonly replayed: boolean;
}

interface LockedOrder {
  id: string;
  club_id: string;
  customer_id: string;
  reference: string;
  status: OrderStatus;
  total_minor: number;
  currency: string;
  paid_provider: string | null;
  paid_provider_payment_id: string | null;
}

async function lockOrder(tx: Tx, orderId: string): Promise<LockedOrder | undefined> {
  const rows = await tx.$queryRaw<LockedOrder[]>`
    SELECT id::text AS id, club_id::text AS club_id, customer_id::text AS customer_id, reference,
      status, total_minor, currency, paid_provider, paid_provider_payment_id
    FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`;
  return rows[0];
}

function paymentData(payment: VerifiedPayment) {
  return {
    provider: payment.provider,
    providerPaymentId: payment.providerPaymentId,
    amountMinor: payment.amountMinor,
    currency: payment.currency,
  };
}

/** الرفض يُكتب في التدقيق ثم يُعتمد، فلا تضيع دفعة وصلت ولم تُسجَّل. */
async function rejectPayment(
  tx: Tx,
  order: LockedOrder,
  input: MarkOrderPaidInput,
  error: DomainError,
): Promise<Result<never, DomainError>> {
  await writeAudit(tx, {
    clubId: order.club_id,
    entityType: "order",
    entityId: order.id,
    action: "payment_rejected",
    fromState: order.status,
    toState: null,
    actor: input.actor,
    data: { ...paymentData(input.payment), reason: error.reason },
    at: input.now,
  });
  return err(error);
}

function isSettledStatus(status: OrderStatus): status is SettledOrderStatus {
  return (SETTLED_STATUSES as readonly string[]).includes(status);
}

/** الإعادة لا تكون إلا على طلب سُجّلت دفعته؛ غير ذلك يعني أن `paid_*` كُتبت لطلب لم يُدفع. */
function settledStatus(order: LockedOrder): SettledOrderStatus {
  if (!isSettledStatus(order.status)) {
    throw new DomainError("invariant", "order.replay_unexpected_status");
  }
  return order.status;
}

async function replayResult(tx: Tx, order: LockedOrder): Promise<PaidOrder> {
  const membership = await tx.membership.findUnique({
    where: { orderId: order.id },
    select: { id: true },
  });
  return {
    orderId: order.id,
    reference: order.reference,
    status: settledStatus(order),
    membershipId: membership?.id ?? null,
    replayed: true,
  };
}

async function isPaymentUsedElsewhere(tx: Tx, order: LockedOrder, payment: VerifiedPayment) {
  const other = await tx.order.findFirst({
    where: {
      paidProvider: payment.provider,
      paidProviderPaymentId: payment.providerPaymentId,
      id: { not: order.id },
    },
    select: { id: true },
  });
  return other !== null;
}

/** الخطوة 4: الانتقال مشروط بـ`pending_payment` ويجب أن يمسّ صفًا واحدًا. */
async function recordPayment(tx: Tx, order: LockedOrder, input: MarkOrderPaidInput): Promise<void> {
  const { payment, now } = input;
  const updated = await tx.$executeRaw`
    UPDATE orders SET status = 'paid', paid_at = ${now}, paid_provider = ${payment.provider},
      paid_provider_payment_id = ${payment.providerPaymentId},
      paid_amount_minor = ${payment.amountMinor}, paid_currency = ${payment.currency}
    WHERE id = ${order.id}::uuid AND status = 'pending_payment'`;
  if (updated !== 1) {
    throw new DomainError("invariant", "order.payment_not_recorded");
  }
  await writeAudit(tx, {
    clubId: order.club_id,
    entityType: "order",
    entityId: order.id,
    action: "payment_verified",
    fromState: "pending_payment",
    toState: "paid",
    actor: input.actor,
    data: paymentData(payment),
    at: now,
  });
}

/** الخطوة 6: الطلب بلا برنامج رقمي يُسلَّم فورًا؛ البرنامج الرقمي يبقى `paid` (تسليمه بلا مستدعٍ). */
async function fulfilIfNoDigital(tx: Tx, order: LockedOrder, input: MarkOrderPaidInput) {
  const digital = await tx.orderItem.count({
    where: { orderId: order.id, kind: "digital_program" },
  });
  if (digital > 0) {
    return "paid" as const;
  }
  await tx.$executeRaw`
    UPDATE orders SET status = 'fulfilled', fulfilled_at = ${input.now}
    WHERE id = ${order.id}::uuid AND status = 'paid'`;
  await writeAudit(tx, {
    clubId: order.club_id,
    entityType: "order",
    entityId: order.id,
    action: "order_fulfilled",
    fromState: "paid",
    toState: "fulfilled",
    actor: "system",
    data: { reference: order.reference },
    at: input.now,
  });
  return "fulfilled" as const;
}

async function settleInTransaction(
  tx: Tx,
  input: MarkOrderPaidInput,
): Promise<Result<PaidOrder, DomainError>> {
  const order = await lockOrder(tx, input.orderId);
  if (order === undefined) {
    return err(new DomainError("not_found", "order.not_found"));
  }
  const paid =
    order.paid_provider === null || order.paid_provider_payment_id === null
      ? null
      : { provider: order.paid_provider, providerPaymentId: order.paid_provider_payment_id };
  const total = money(order.total_minor, order.currency);
  const decision = decideSettlement({ status: order.status, total, paid }, input.payment);
  if (!decision.ok) {
    return rejectPayment(tx, order, input, decision.error);
  }
  if (decision.value === "replay") {
    return ok(await replayResult(tx, order));
  }
  if (await isPaymentUsedElsewhere(tx, order, input.payment)) {
    return rejectPayment(tx, order, input, new DomainError("conflict", "payment.already_used"));
  }
  await recordPayment(tx, order, input);
  const membershipId = await createMembershipForOrder(tx, order, input.now);
  const status = await fulfilIfNoDigital(tx, order, input);
  return ok({
    orderId: order.id,
    reference: order.reference,
    status,
    membershipId,
    replayed: false,
  });
}

/**
 * يسجّل الدفعة ويفعّل الاشتراك مرة واحدة لكل طلب. النداء المكرر بالدفعة نفسها يرجع النتيجة نفسها
 * (`replayed`) بلا كتابة، والرفض يُعتمد مع سطر تدقيقه.
 */
export async function markOrderPaid(
  db: Db,
  input: MarkOrderPaidInput,
): Promise<Result<PaidOrder, DomainError>> {
  try {
    return await inTransaction(db, (tx) => settleInTransaction(tx, input));
  } catch (error) {
    const mapped = mapCommerceDbError(error);
    if (mapped !== undefined) {
      return err(mapped);
    }
    throw error;
  }
}
