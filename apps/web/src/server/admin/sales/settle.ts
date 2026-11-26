import "server-only";
import { randomUUID } from "node:crypto";
import {
  findManualReferenceUse,
  getOrderDetail,
  recordManualPayment,
  type OrderDetail,
  type PaidOrder,
} from "@masar/db";
import {
  DomainError,
  decideManualSettlement,
  err,
  hasPermission,
  ok,
  parsePlainDate,
  parseSarAmount,
  plainDateInZone,
  validateManualPayment,
  type Result,
} from "@masar/domain";
import { isCheckoutPreview } from "../../checkout/flag";
import { getDb } from "../../db";
import { logger } from "../../logger";
import { adminSecretKey } from "../flag";
import type { StaffContext } from "../session";
import { allowManualSettle } from "../throttle";
import type { SettleValues } from "./form-state";
import { openSettleToken, sealSettleToken, type SettleTokenPayload } from "./settle-token";

/**
 * خدمة الدفع اليدوي للوحة (ADMIN_A2_SALES §6.5). الخطوة الأولى تتحقق ولا تكتب، وتختم ما رُوجع في
 * رمز؛ الثانية تنفّذ ما في الرمز وحده عبر `recordManualPayment`. في وضع المعاينة يُرفض كل شيء **قبل
 * أي قراءة** (القرار 59): طلبات المعاينة للعرض فقط ولا تُعلَّم في القاعدة.
 */
const PREVIEW_REFUSED = "orders.settle_preview_refused";

function refuse(reason: string, code: "conflict" | "validation" | "forbidden" = "conflict") {
  return err(new DomainError(code, reason));
}

const REFERENCE_USED = "manual_payment.reference_used";

/** سبب الرفض، ومعه مرجع الطلب الذي استعمل المرجع الخارجي من قبل حين يكون هذا هو السبب. */
export interface SettleFailure {
  readonly reason: string;
  readonly usedByOrder: string | null;
}

type SettleResult<T> = Result<T, SettleFailure>;

/**
 * يحوّل خطأ العمل إلى سبب يُعرض. المرجع المكرر يُسمّى طلبه (ليتحقق الموظف من الحوالة) لمن يملك قراءة
 * الطلبات فقط؛ البحث بالمفتاح الموحَّد داخل نادي الموظف.
 */
async function failure(
  context: StaffContext,
  error: DomainError,
  externalReference: string | null,
): Promise<SettleResult<never>> {
  const canName =
    error.reason === REFERENCE_USED &&
    externalReference !== null &&
    hasPermission(context.staff.role, "orders.read");
  const use = canName
    ? await findManualReferenceUse(getDb(), context.staff.clubId, externalReference)
    : undefined;
  return err({ reason: error.reason, usedByOrder: use?.orderReference ?? null });
}

export interface PreparedSettlement {
  readonly token: string;
  readonly payload: SettleTokenPayload;
}

function binding(context: StaffContext, orderId: string) {
  return { key: adminSecretKey(), staffId: context.staff.id, orderId };
}

/** القرار نفسه الذي تتخذه القاعدة تحت القفل، مبكرًا ليُعرض الخطأ قبل صفحة التأكيد. */
function precheck(detail: OrderDetail, payload: SettleTokenPayload, now: Date) {
  const { order, payment, attempts } = detail;
  return decideManualSettlement(
    {
      status: order.status,
      expiresAt: order.expiresAt,
      total: order.total,
      hasLiveAttempt: attempts.some((attempt) => attempt.live),
      existing:
        payment === null
          ? null
          : { provider: payment.provider, providerPaymentId: payment.providerPaymentId },
    },
    { paymentId: payload.paymentId, amountMinor: payload.amountMinor, currency: payload.currency },
    now,
  );
}

function toPayload(
  detail: OrderDetail,
  values: SettleValues,
  now: Date,
): Result<SettleTokenPayload, DomainError> {
  const { order } = detail;
  const amount = parseSarAmount(values.amount);
  if (!amount.ok) {
    return amount;
  }
  const receivedOn = parsePlainDate(values.receivedOn);
  if (!receivedOn.ok) {
    return refuse("manual_payment.received_on_invalid", "validation");
  }
  const details = validateManualPayment(
    { ...values, receivedOn: receivedOn.value },
    {
      orderCreatedOn: plainDateInZone(order.createdAt, order.timeZone),
      today: plainDateInZone(now, order.timeZone),
    },
  );
  if (!details.ok) {
    return details;
  }
  return ok({
    paymentId: randomUUID(),
    details: details.value,
    amountMinor: amount.value,
    currency: order.total.currency,
  });
}

async function prepareChecked(
  context: StaffContext,
  orderId: string,
  values: SettleValues,
  now: Date,
): Promise<Result<SettleTokenPayload, DomainError>> {
  const detail = await getOrderDetail(getDb(), context.staff.clubId, orderId, now);
  if (detail === undefined) {
    return err(new DomainError("not_found", "order.not_found"));
  }
  const payload = toPayload(detail, values, now);
  if (!payload.ok) {
    return payload;
  }
  const decision = precheck(detail, payload.value, now);
  if (!decision.ok) {
    return decision;
  }
  if (decision.value === "replay") {
    return refuse("order.already_paid");
  }
  const { externalReference } = payload.value.details;
  const used = await findManualReferenceUse(getDb(), context.staff.clubId, externalReference);
  return used === undefined ? payload : refuse(REFERENCE_USED);
}

/** الخطوة 1: تتحقق من البيانات والطلب والمرجع، ولا تكتب شيئًا. ترجع الرمز المختوم وما فيه. */
export async function prepareManualSettlement(
  context: StaffContext,
  orderId: string,
  values: SettleValues,
  now: Date,
): Promise<SettleResult<PreparedSettlement>> {
  if (isCheckoutPreview()) {
    return err({ reason: PREVIEW_REFUSED, usedByOrder: null });
  }
  const payload = await prepareChecked(context, orderId, values, now);
  if (!payload.ok) {
    return failure(context, payload.error, sanitizeReference(values.externalReference));
  }
  const token = sealSettleToken(binding(context, orderId), payload.value, now);
  return ok({ token, payload: payload.value });
}

/** المرجع كما كُتب، للبحث عن مستعمله: المفتاح الموحَّد يتكفل بالشكل. */
function sanitizeReference(raw: string): string | null {
  return raw.trim() === "" ? null : raw;
}

export interface ConfirmSettlementInput {
  readonly orderId: string;
  readonly token: string;
  /** مربع «تحققتُ من وصول المبلغ». */
  readonly confirmed: boolean;
}

interface Checked {
  readonly result: Result<PaidOrder, DomainError>;
  /** المرجع الخارجي من الرمز المختوم (لا مما أرسله المتصفح)، إن فُتح الرمز. */
  readonly externalReference: string | null;
}

async function confirmChecked(
  context: StaffContext,
  input: ConfirmSettlementInput,
  now: Date,
): Promise<Checked> {
  if (!allowManualSettle(context.staff.id)) {
    return {
      result: refuse("orders.settle_too_many_attempts", "forbidden"),
      externalReference: null,
    };
  }
  if (!input.confirmed) {
    return {
      result: refuse("orders.settle_confirmation_required", "validation"),
      externalReference: null,
    };
  }
  const payload = openSettleToken(binding(context, input.orderId), input.token, now);
  if (payload === null) {
    return { result: refuse("orders.settle_token_invalid", "validation"), externalReference: null };
  }
  const result = await recordManualPayment(getDb(), {
    paymentId: payload.paymentId,
    orderId: input.orderId,
    clubId: context.staff.clubId,
    details: payload.details,
    amountMinor: payload.amountMinor,
    currency: payload.currency,
    staffId: context.staff.id,
    now,
  });
  return { result, externalReference: payload.details.externalReference };
}

/**
 * الخطوة 2: تقبل الرمز المختوم وحده، فما يُنفَّذ هو ما رُوجع. المحاولة المرفوضة لا تكتب في القاعدة
 * شيئًا (القرار يسبق أي كتابة)، فتُكتب في السجل المنظَّم: من، وأي طلب، ولماذا. بلا مبلغ ولا مرجع.
 */
export async function confirmManualSettlement(
  context: StaffContext,
  input: ConfirmSettlementInput,
  now: Date,
): Promise<SettleResult<PaidOrder>> {
  if (isCheckoutPreview()) {
    return err({ reason: PREVIEW_REFUSED, usedByOrder: null });
  }
  const { result, externalReference } = await confirmChecked(context, input, now);
  if (result.ok) {
    return result;
  }
  logger.warn("admin.manual_settle_refused", {
    staffId: context.staff.id,
    orderId: input.orderId,
    reason: result.error.reason,
  });
  return failure(context, result.error, externalReference);
}
