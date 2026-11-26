import { DomainError } from "../../errors";
import type { Money } from "../../money";
import { err, ok, type Result } from "../../result";
import type { OrderStatus } from "./order-state";
import { comparePlainDates, type PlainDate } from "./plain-date";
import type { PaymentReference, SettlementDecision } from "./settlement";

/** اسم «المزوّد» على طلب سُوّي يدويًا من اللوحة. القاعدة تشترط له صفًا في `manual_payments` (T13). */
export const MANUAL_PAYMENT_PROVIDER = "manual";

/** طرق الدفع اليدوي (ADMIN_A2_SALES §6.5، سؤال المالك 2). */
export const MANUAL_PAYMENT_METHODS = ["bank_transfer", "paid_at_club"] as const;
export type ManualPaymentMethod = (typeof MANUAL_PAYMENT_METHODS)[number];

export function isManualPaymentMethod(value: unknown): value is ManualPaymentMethod {
  return MANUAL_PAYMENT_METHODS.some((method) => method === value);
}

export interface ManuallySettleableOrder {
  readonly status: OrderStatus;
  readonly expiresAt: Date;
  readonly total: Money;
  readonly hasLiveAttempt: boolean;
  /** الدفعة المسجّلة على الطلب (يدوية أو من مزوّد)، أو null إن لم يُدفع. */
  readonly existing: PaymentReference | null;
}

export interface ManualSettlementRequest {
  /** معرّف صف `manual_payments`: مفتاح عدم التكرار، وهو معرّف الدفعة على الطلب. */
  readonly paymentId: string;
  readonly amountMinor: number;
  readonly currency: string;
}

function isSameManualPayment(existing: PaymentReference, request: ManualSettlementRequest) {
  return (
    existing.provider === MANUAL_PAYMENT_PROVIDER &&
    existing.providerPaymentId === request.paymentId
  );
}

/**
 * يقرر تسجيل دفع يدوي. أشدّ من `decideSettlement`: يفحص المهلة بالوقت (طلب بلغ مهلته لا يُدفع ولو
 * لم يُكتب منتهيًا، فلا شرط صلب يحميه هنا كما يحمي دفعة المزوّد)، ويرفض مع محاولة دفع حيّة (العميل
 * يدفع الآن عند المزوّد). الدفعة نفسها مرة ثانية إعادة بلا كتابة.
 */
export function decideManualSettlement(
  order: ManuallySettleableOrder,
  request: ManualSettlementRequest,
  now: Date,
): Result<SettlementDecision, DomainError> {
  if (order.existing !== null) {
    return isSameManualPayment(order.existing, request)
      ? ok("replay")
      : err(new DomainError("conflict", "order.already_paid"));
  }
  if (order.status !== "pending_payment") {
    return err(new DomainError("conflict", "order.not_payable"));
  }
  if (now.getTime() >= order.expiresAt.getTime()) {
    return err(new DomainError("conflict", "order.payment_window_passed"));
  }
  if (order.hasLiveAttempt) {
    return err(new DomainError("conflict", "order.settle_blocked_by_live_attempt"));
  }
  if (request.currency !== order.total.currency) {
    return err(new DomainError("conflict", "payment.currency_mismatch"));
  }
  if (request.amountMinor !== order.total.amountMinor) {
    return err(new DomainError("conflict", "payment.amount_mismatch", { field: "amount" }));
  }
  return ok("apply");
}

const MIN_REFERENCE_LENGTH = 3;
const MAX_REFERENCE_LENGTH = 64;
const MAX_NOTE_LENGTH = 500;
/** محارف التحكم والتنسيق غير المرئية لا تدخل مرجعًا يُطابَق لاحقًا بالعين. */
const INVISIBLE = /[\p{Cc}\p{Cf}]/gu;

export interface ManualPaymentDraft {
  readonly method: string;
  readonly externalReference: string;
  readonly receivedOn: PlainDate;
  readonly note: string;
}

export interface ManualPaymentDetails {
  readonly method: ManualPaymentMethod;
  /** مرجع الحوالة أو رقم سند القبض، مشذَّبًا. */
  readonly externalReference: string;
  readonly receivedOn: PlainDate;
  readonly note: string | null;
}

export interface ManualPaymentCalendar {
  /** يوم إنشاء الطلب بتقويم النادي. */
  readonly orderCreatedOn: PlainDate;
  /** اليوم بتقويم النادي. */
  readonly today: PlainDate;
}

function invalid(reason: string, field: string): Result<never, DomainError> {
  return err(new DomainError("validation", reason, { field }));
}

/** الطول بالمحارف كما يحسبه `char_length` في PostgreSQL. */
function charLength(text: string): number {
  return Array.from(text).length;
}

/**
 * بيانات الدفعة اليدوية كما تُحفظ: طريقة من القائمة، ومرجع خارجي إلزامي من 3 إلى 64 محرفًا، وتاريخ
 * استلام ليس بعد اليوم ولا قبل يوم إنشاء الطلب (مال استُلم قبل وجود الطلب ليس لهذا الطلب)، وملاحظة
 * اختيارية حتى 500 محرف.
 */
export function validateManualPayment(
  draft: ManualPaymentDraft,
  calendar: ManualPaymentCalendar,
): Result<ManualPaymentDetails, DomainError> {
  if (!isManualPaymentMethod(draft.method)) {
    return invalid("manual_payment.method_invalid", "method");
  }
  const externalReference = draft.externalReference.replace(INVISIBLE, "").trim();
  const length = charLength(externalReference);
  if (length < MIN_REFERENCE_LENGTH || length > MAX_REFERENCE_LENGTH) {
    return invalid("manual_payment.reference_invalid", "externalReference");
  }
  if (
    comparePlainDates(draft.receivedOn, calendar.today) > 0 ||
    comparePlainDates(draft.receivedOn, calendar.orderCreatedOn) < 0
  ) {
    return invalid("manual_payment.received_on_invalid", "receivedOn");
  }
  const note = draft.note.trim();
  if (charLength(note) > MAX_NOTE_LENGTH) {
    return invalid("manual_payment.note_too_long", "note");
  }
  return ok({
    method: draft.method,
    externalReference,
    receivedOn: draft.receivedOn,
    note: note === "" ? null : note,
  });
}
