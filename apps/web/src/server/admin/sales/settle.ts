import "server-only";
import { randomUUID } from "node:crypto";
import { getOrderDetail, recordManualPayment, type OrderDetail, type PaidOrder } from "@masar/db";
import {
  DomainError,
  decideManualSettlement,
  err,
  ok,
  parsePlainDate,
  parseSarAmount,
  plainDateInZone,
  validateManualPayment,
  type Result,
} from "@masar/domain";
import { isCheckoutPreview } from "../../checkout/flag";
import { getDb } from "../../db";
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

/** الخطوة 1: تتحقق من البيانات والطلب، ولا تكتب شيئًا. ترجع الرمز المختوم وما فيه لإعادة العرض. */
export async function prepareManualSettlement(
  context: StaffContext,
  orderId: string,
  values: SettleValues,
  now: Date,
): Promise<Result<PreparedSettlement, DomainError>> {
  if (isCheckoutPreview()) {
    return refuse(PREVIEW_REFUSED, "forbidden");
  }
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
  const token = sealSettleToken(binding(context, orderId), payload.value, now);
  return ok({ token, payload: payload.value });
}

export interface ConfirmSettlementInput {
  readonly orderId: string;
  readonly token: string;
  /** مربع «تحققتُ من وصول المبلغ». */
  readonly confirmed: boolean;
}

/** الخطوة 2: تقبل الرمز المختوم وحده، فما يُنفَّذ هو ما رُوجع. */
export async function confirmManualSettlement(
  context: StaffContext,
  input: ConfirmSettlementInput,
  now: Date,
): Promise<Result<PaidOrder, DomainError>> {
  if (isCheckoutPreview()) {
    return refuse(PREVIEW_REFUSED, "forbidden");
  }
  if (!allowManualSettle(context.staff.id)) {
    return refuse("orders.settle_too_many_attempts", "forbidden");
  }
  if (!input.confirmed) {
    return refuse("orders.settle_confirmation_required", "validation");
  }
  const payload = openSettleToken(binding(context, input.orderId), input.token, now);
  if (payload === null) {
    return refuse("orders.settle_token_invalid", "validation");
  }
  return recordManualPayment(getDb(), {
    paymentId: payload.paymentId,
    orderId: input.orderId,
    clubId: context.staff.clubId,
    details: payload.details,
    amountMinor: payload.amountMinor,
    currency: payload.currency,
    staffId: context.staff.id,
    now,
  });
}
