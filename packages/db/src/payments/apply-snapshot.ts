/**
 * نقطة الدخول الوحيدة من لقطة المزوّد إلى الطلب: تطبّق قرار `decideVerification` على المحاولة، وهي
 * **الوحيدة التي تستدعي `markOrderPaid`**. الإشعار وصفحة العودة ومهمة المطابقة كلها تمر من هنا بعد
 * قراءة الجلسة من المزوّد نفسه. لا استدعاء خارجي هنا، ولا تفعيل من جسم إشعار أو رابط.
 *
 * ثلاث خطوات تتحمل الانقطاع بينها: (1) معاملة تكتب ما رُصد على المحاولة، (2) `markOrderPaid`
 * بمعاملتها، (3) معاملة تكتب نتيجة التسوية والحادثة. إن انقطعت بعد (1) أو (2) بقيت المحاولة حيّة
 * (`captured` بلا تسوية) فتحمي طلبها، والإعادة ترجع `replayed` بلا أثر مزدوج.
 */
import {
  DomainError,
  decideVerification,
  incidentKindForRejection,
  ok,
  type AttemptStatus,
  type IncidentKind,
  type IncidentNote,
  type ProviderSessionSnapshot,
  type Result,
  type VerificationDecision,
  type VerifiedPayment,
} from "@masar/domain";
import type { Db } from "../client";
import { writeAudit } from "../commerce/audit";
import { markOrderPaid, type PaidOrder } from "../commerce/mark-order-paid";
import { abort, inTransaction, type Tx } from "../commerce/transaction";
import { openIncidents } from "./incidents";
import { lockAttempt, toAttemptFacts, toAttemptRecord, type PaymentAttemptRecord } from "./records";
import { nextStatus, observedData, rejectReusedPayment, toPlan } from "./snapshot-plan";

export interface ApplySnapshotInput {
  readonly attemptId: string;
  /** جلسة قرأها المستدعي من المزوّد بالمفتاح السري. لا تُبنى من إشعار ولا من رابط عودة. */
  readonly snapshot: ProviderSessionSnapshot;
  readonly now: Date;
  readonly stuckAlertAfterMs: number;
}

export interface SyncOutcome {
  readonly attemptId: string;
  readonly orderId: string;
  readonly previousStatus: AttemptStatus;
  readonly status: AttemptStatus;
  readonly action: VerificationDecision["action"];
  /** نتيجة `markOrderPaid` في هذا النداء: paid أو replayed أو سبب الرفض، أو null إن لم تُستدعَ. */
  readonly settlement: string | null;
  readonly paidOrder: PaidOrder | null;
  /** الحوادث التي فُتحت الآن (لا المفتوحة من قبل): يُكتب لها سطر التنبيه مرة واحدة. */
  readonly openedIncidents: readonly IncidentKind[];
}

interface Observation {
  readonly before: PaymentAttemptRecord;
  readonly after: PaymentAttemptRecord;
  readonly action: VerificationDecision["action"];
  readonly payment: VerifiedPayment | null;
  readonly opened: IncidentKind[];
}

/** الخطوة 1: القرار وكتابة ما رُصد على المحاولة تحت قفل صفها، مع التدقيق والحوادث. */
async function observe(tx: Tx, input: ApplySnapshotInput): Promise<Observation> {
  const before = await lockAttempt(tx, input.attemptId);
  if (before === undefined) {
    return abort(new DomainError("not_found", "payment_attempt.not_found"));
  }
  const context = { now: input.now, stuckAlertAfterMs: input.stuckAlertAfterMs };
  const decision = decideVerification(toAttemptFacts(before), input.snapshot, context);
  const plan = await rejectReusedPayment(tx, before, toPlan(decision));
  const status = nextStatus(before, plan.event);
  const row = await tx.paymentAttempt.update({
    where: { id: before.id },
    data: observedData(before, plan, status, input),
  });
  if (status !== before.status) {
    await writeAudit(tx, {
      clubId: before.clubId,
      entityType: "payment_attempt",
      entityId: before.id,
      action: `payment_attempt_${status}`,
      fromState: before.status,
      toState: status,
      actor: "provider",
      data: { provider: before.provider, providerStatus: input.snapshot.rawStatus },
      at: input.now,
    });
  }
  const opened = await openIncidents(tx, incidentTarget(before), plan.notes, input.now);
  const after = toAttemptRecord(row);
  return { before, after, action: decision.action, payment: plan.payment, opened };
}

function incidentTarget(attempt: PaymentAttemptRecord) {
  return { clubId: attempt.clubId, orderId: attempt.orderId, attemptId: attempt.id };
}

function settlementLabel(result: Result<PaidOrder, DomainError>): string {
  if (!result.ok) {
    return result.error.reason;
  }
  return result.value.replayed ? "replayed" : "paid";
}

/** رفض `markOrderPaid` ⇒ حادثة تنبّه الإدارة. سبب غير معروف عطل يُرمى، لا يُطوى في حادثة. */
function rejectionNote(error: DomainError, payment: VerifiedPayment): IncidentNote {
  const kind = incidentKindForRejection(error.reason);
  if (kind === undefined) {
    throw error;
  }
  return {
    kind,
    data: {
      reason: error.reason,
      provider: payment.provider,
      providerPaymentId: payment.providerPaymentId,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
    },
  };
}

/** الخطوة 3: نتيجة التسوية تُكتب مرة (`settled_at IS NULL`)، ومع الرفض تُفتح حادثته. */
async function recordSettlement(
  tx: Tx,
  attempt: PaymentAttemptRecord,
  payment: VerifiedPayment,
  result: Result<PaidOrder, DomainError>,
  now: Date,
): Promise<IncidentKind[]> {
  const label = settlementLabel(result);
  const written = await tx.$executeRaw`
    UPDATE payment_attempts SET settled_at = ${now}, settlement_result = ${label}, updated_at = ${now}
    WHERE id = ${attempt.id}::uuid AND settled_at IS NULL`;
  if (written === 1) {
    await writeAudit(tx, {
      clubId: attempt.clubId,
      entityType: "payment_attempt",
      entityId: attempt.id,
      action: "payment_attempt_settled",
      fromState: attempt.status,
      toState: attempt.status,
      actor: "provider",
      data: { result: label, providerPaymentId: payment.providerPaymentId },
      at: now,
    });
  }
  if (result.ok) {
    return [];
  }
  return openIncidents(tx, incidentTarget(attempt), [rejectionNote(result.error, payment)], now);
}

function outcome(
  observed: Observation,
  settlement: string | null,
  paidOrder: PaidOrder | null,
  openedIncidents: readonly IncidentKind[],
): SyncOutcome {
  return {
    attemptId: observed.after.id,
    orderId: observed.after.orderId,
    previousStatus: observed.before.status,
    status: observed.after.status,
    action: observed.action,
    settlement,
    paidOrder,
    openedIncidents,
  };
}

/**
 * يطبّق لقطة مزوّد على محاولتنا. إن كانت فيها دفعة مدفوعة ومطابقة المراجع استُدعيت `markOrderPaid`
 * بقيم الدفعة الخام (هي التي تطابق المبلغ والعملة بالهللة)، ومرة واحدة لكل طلب مهما تكرر النداء أو
 * تزامن. كل رفض يُكتب نتيجةً على المحاولة ويفتح حادثة، ولا يُفعَّل به شيء.
 */
export async function applyProviderSnapshot(
  db: Db,
  input: ApplySnapshotInput,
): Promise<Result<SyncOutcome, DomainError>> {
  const observed = await inTransaction(db, async (tx) => ok(await observe(tx, input)));
  if (!observed.ok) {
    return observed;
  }
  const { after, payment, opened } = observed.value;
  if (payment === null) {
    return ok(outcome(observed.value, null, null, opened));
  }
  const paid = await markOrderPaid(db, {
    orderId: after.orderId,
    payment,
    actor: "provider",
    now: input.now,
  });
  const recorded = await inTransaction(db, async (tx) =>
    ok(await recordSettlement(tx, after, payment, paid, input.now)),
  );
  if (!recorded.ok) {
    return recorded;
  }
  const incidents = [...opened, ...recorded.value];
  return ok(outcome(observed.value, settlementLabel(paid), paid.ok ? paid.value : null, incidents));
}
