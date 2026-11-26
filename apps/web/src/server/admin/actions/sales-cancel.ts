"use server";

import { redirect } from "next/navigation";
import { orderPath } from "@/config/admin";
import { failed, idField, textField, type AdminFormState } from "../form";
import { requireStaff } from "../guard";
import { cancelOrder } from "../sales/cancel";

const INVALID = "sales.invalid_request";
const CODE_INPUT_LENGTH = 32;

function done(orderId: string, notice: string): never {
  redirect(`${orderPath(orderId)}?done=${notice}`);
}

/** إلغاء طلب معلّق بسبب من القائمة المغلقة. الإعادة على ملغى تنتهي بالنتيجة نفسها. */
export async function cancelOrderAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const context = await requireStaff("orders.cancel");
  const orderId = idField(formData, "orderId");
  if (orderId === null) {
    return failed(INVALID);
  }
  const reason = textField(formData, "reason", CODE_INPUT_LENGTH);
  const cancelled = await cancelOrder(context, orderId, reason, new Date());
  if (!cancelled.ok) {
    return failed(cancelled.error.reason);
  }
  done(orderId, "order_cancelled");
}
