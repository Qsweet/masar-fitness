/**
 * تسجيل دفع يدوي من اللوحة (ADMIN_A2_SALES §6.5). معاملة واحدة بترتيب أقفال `markOrderPaid` نفسه
 * (الطلب ثم العميل): القرار في المجال، ثم صف `manual_payments`، ثم **التسوية بالمسار الوحيد**
 * `settleInTransaction`، ثم سطر التدقيق. أي رفض من التسوية يتراجع عن كل شيء. معرّف الدفعة مفتاح عدم
 * التكرار، و T12 و T13 و`UNIQUE(memberships.order_id)` سدود القاعدة.
 */
import {
  DomainError,
  MANUAL_PAYMENT_PROVIDER,
  decideManualSettlement,
  err,
  formatPlainDate,
  manualReferenceKey,
  money,
  sanitizeFreeText,
  type ManualPaymentDetails,
  type Result,
} from "@masar/domain";
import type { Db } from "../client";
import { writeAudit } from "../commerce/audit";
import { settleInTransaction, type PaidOrder } from "../commerce/mark-order-paid";
import { mapCommerceDbError } from "../commerce/sql-errors";
import { abort, inTransaction, type Tx } from "../commerce/transaction";
import { staffActor } from "../staff/audit";
import { hasLiveAttempt, lockOrderInClub, type LockedAdminOrder } from "./locks";
import { mapOrdersAdminDbError } from "./sql-errors";

export interface RecordManualPaymentInput {
  /** يولَّد عند رسم نموذج التأكيد ويُختم في رمزه: الإرسال الثاني به إعادة بلا أثر. */
  readonly paymentId: string;
  readonly orderId: string;
  readonly clubId: string;
  readonly details: ManualPaymentDetails;
  readonly amountMinor: number;
  readonly currency: string;
  readonly staffId: string;
  readonly now: Date;
}

function paidReference(order: LockedAdminOrder) {
  return order.paid_provider === null || order.paid_provider_payment_id === null
    ? null
    : { provider: order.paid_provider, providerPaymentId: order.paid_provider_payment_id };
}

/** الملاحظة كما تُحفظ: تنظيف المجال نفسه مرة أخرى عند الحد، فلا يصل NUL إلى القاعدة من أي مستدعٍ. */
function storedNote(note: string | null): string | null {
  const clean = note === null ? "" : sanitizeFreeText(note);
  return clean === "" ? null : clean;
}

async function insertManualPayment(tx: Tx, input: RecordManualPaymentInput): Promise<void> {
  const { details } = input;
  await tx.$executeRaw`
    INSERT INTO manual_payments (id, club_id, order_id, method, external_reference, reference_key,
      received_on, amount_minor, currency, note, recorded_by, created_at)
    VALUES (${input.paymentId}::uuid, ${input.clubId}::uuid, ${input.orderId}::uuid,
      ${details.method}, ${details.externalReference},
      ${manualReferenceKey(details.externalReference)},
      ${formatPlainDate(details.receivedOn)}::date, ${input.amountMinor}, ${input.currency},
      ${storedNote(details.note)}, ${input.staffId}::uuid, ${input.now})`;
}

export interface ManualReferenceUse {
  readonly orderId: string;
  readonly orderReference: string;
}

/**
 * الطلب الذي سوّاه هذا المرجع الخارجي في النادي، بأي طريقة وبأي كتابة (المطابقة بالمفتاح الموحَّد)،
 * أو undefined. يُعرض مرجع ذلك الطلب للموظف حين يُرفض مرجع مكرر.
 */
export async function findManualReferenceUse(
  db: Db | Tx,
  clubId: string,
  externalReference: string,
): Promise<ManualReferenceUse | undefined> {
  const used = await db.manualPayment.findUnique({
    where: {
      clubId_referenceKey: { clubId, referenceKey: manualReferenceKey(externalReference) },
    },
    select: { orderId: true, order: { select: { reference: true } } },
  });
  return used === null
    ? undefined
    : { orderId: used.orderId, orderReference: used.order.reference };
}

async function isReferenceUsed(tx: Tx, input: RecordManualPaymentInput): Promise<boolean> {
  const use = await findManualReferenceUse(tx, input.clubId, input.details.externalReference);
  return use !== undefined;
}

function settle(tx: Tx, input: RecordManualPaymentInput) {
  return settleInTransaction(tx, {
    orderId: input.orderId,
    payment: {
      provider: MANUAL_PAYMENT_PROVIDER,
      providerPaymentId: input.paymentId,
      amountMinor: input.amountMinor,
      currency: input.currency,
    },
    actor: staffActor(input.staffId),
    now: input.now,
  });
}

async function writeRecorded(tx: Tx, input: RecordManualPaymentInput): Promise<void> {
  await writeAudit(tx, {
    clubId: input.clubId,
    entityType: "manual_payment",
    entityId: input.paymentId,
    action: "manual_payment_recorded",
    fromState: null,
    toState: null,
    actor: staffActor(input.staffId),
    data: {
      orderId: input.orderId,
      method: input.details.method,
      externalReference: input.details.externalReference,
      receivedOn: formatPlainDate(input.details.receivedOn),
      amountMinor: input.amountMinor,
      currency: input.currency,
    },
    at: input.now,
  });
}

async function recordInTransaction(
  tx: Tx,
  input: RecordManualPaymentInput,
): Promise<Result<PaidOrder, DomainError>> {
  const order = await lockOrderInClub(tx, input.orderId, input.clubId);
  if (order === undefined) {
    return err(new DomainError("not_found", "order.not_found"));
  }
  const decision = decideManualSettlement(
    {
      status: order.status,
      expiresAt: order.expires_at,
      total: money(order.total_minor, order.currency),
      hasLiveAttempt: await hasLiveAttempt(tx, order.id),
      existing: paidReference(order),
    },
    { paymentId: input.paymentId, amountMinor: input.amountMinor, currency: input.currency },
    input.now,
  );
  if (!decision.ok) {
    return decision;
  }
  if (decision.value === "replay") {
    return settle(tx, input);
  }
  if (await isReferenceUsed(tx, input)) {
    return err(
      new DomainError("conflict", "manual_payment.reference_used", { field: "externalReference" }),
    );
  }
  await insertManualPayment(tx, input);
  const settled = await settle(tx, input);
  if (!settled.ok) {
    // التسوية كتبت سطر رفضها؛ التراجع الكامل يمحوه مع صف الدفعة: لا صف يدوي بلا تسوية
    abort(settled.error);
  }
  await writeRecorded(tx, input);
  return settled;
}

/**
 * يسجّل دفعة يدوية ويفعّل الاشتراك مرة واحدة. الطلب المنتهي أو الذي بلغ مهلته لا يُدفع، ولا يُسجَّل
 * والعميل في صفحة المزوّد. الإرسال المكرر بالمعرّف نفسه يرجع النتيجة نفسها (`replayed`) بلا كتابة.
 */
export async function recordManualPayment(
  db: Db,
  input: RecordManualPaymentInput,
): Promise<Result<PaidOrder, DomainError>> {
  try {
    return await inTransaction(db, (tx) => recordInTransaction(tx, input));
  } catch (error) {
    const mapped = mapOrdersAdminDbError(error) ?? mapCommerceDbError(error);
    if (mapped !== undefined) {
      return err(mapped);
    }
    throw error;
  }
}
