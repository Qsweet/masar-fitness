"use server";

import { money } from "@masar/domain";
import { redirect } from "next/navigation";
import { orderPath } from "@/config/admin";
import { getAdminDictionary } from "@/i18n/admin";
import { formatAmount, formatPlainDay } from "@/i18n/admin/format";
import { idField, textField } from "../form";
import { requireStaff } from "../guard";
import {
  SETTLE_INTENTS,
  type SettleFormState,
  type SettleIntent,
  type SettleSummary,
  type SettleValues,
} from "../sales/form-state";
import { confirmManualSettlement, prepareManualSettlement } from "../sales/settle";
import { MAX_SETTLE_TOKEN_LENGTH, type SettleTokenPayload } from "../sales/settle-token";

const INVALID = "sales.invalid_request";
const CODE_INPUT_LENGTH = 32;
const REFERENCE_INPUT_LENGTH = 200;
const AMOUNT_INPUT_LENGTH = 32;
const DATE_INPUT_LENGTH = 10;
/** أطول من حد الملاحظة (500): الزائد يصل إلى المجال فيُرفض برسالته لا كحقل فارغ. */
const NOTE_INPUT_LENGTH = 2_000;

function done(orderId: string, notice: string): never {
  redirect(`${orderPath(orderId)}?done=${notice}`);
}

function settleValues(formData: FormData): SettleValues {
  return {
    method: textField(formData, "method", CODE_INPUT_LENGTH),
    externalReference: textField(formData, "externalReference", REFERENCE_INPUT_LENGTH),
    receivedOn: textField(formData, "receivedOn", DATE_INPUT_LENGTH),
    amount: textField(formData, "amount", AMOUNT_INPUT_LENGTH),
    note: textField(formData, "note", NOTE_INPUT_LENGTH),
  };
}

function summaryOf(payload: SettleTokenPayload): SettleSummary {
  const { statuses } = getAdminDictionary().sales;
  return {
    amount: formatAmount(money(payload.amountMinor, payload.currency)),
    method: statuses.manualMethod[payload.details.method],
    externalReference: payload.details.externalReference,
    receivedOn: formatPlainDay(payload.details.receivedOn),
    note: payload.details.note,
  };
}

function intentOf(formData: FormData): SettleIntent | undefined {
  const value = textField(formData, "intent", CODE_INPUT_LENGTH);
  return SETTLE_INTENTS.find((intent) => intent === value);
}

/**
 * الدفع اليدوي بخطوتين في نموذج واحد: «راجع» تتحقق وتختم ما كُتب في رمز ولا تكتب، و«أكّد» تنفّذ ما في
 * الرمز وحده، و«عدّل» تعود إلى الحقول بما كُتب. يعمل بلا JavaScript.
 */
export async function settleOrderAction(
  previous: SettleFormState,
  formData: FormData,
): Promise<SettleFormState> {
  const context = await requireStaff("orders.settle");
  const orderId = idField(formData, "orderId");
  const intent = intentOf(formData);
  if (orderId === null || intent === undefined) {
    return { step: "edit", error: INVALID, values: previous.values };
  }
  if (intent === "edit") {
    return { step: "edit", error: null, values: previous.values };
  }
  const now = new Date();
  if (intent === "review") {
    const values = settleValues(formData);
    const prepared = await prepareManualSettlement(context, orderId, values, now);
    if (!prepared.ok) {
      return { step: "edit", error: prepared.error.reason, values };
    }
    const { token, payload } = prepared.value;
    return { step: "confirm", error: null, values, token, summary: summaryOf(payload) };
  }
  const settled = await confirmManualSettlement(
    context,
    {
      orderId,
      token: textField(formData, "token", MAX_SETTLE_TOKEN_LENGTH),
      confirmed: formData.get("confirmed") === "yes",
    },
    now,
  );
  if (!settled.ok) {
    // خطأ في التأكيد يُبقي صفحة المراجعة إن كانت معروضة، وإلا يعود إلى الحقول
    return previous.step === "confirm"
      ? { ...previous, error: settled.error.reason }
      : { step: "edit", error: settled.error.reason, values: previous.values };
  }
  done(orderId, "manual_payment_recorded");
}
