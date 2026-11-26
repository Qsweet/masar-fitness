"use server";

import type { SalesSettings } from "@masar/domain";
import { redirect } from "next/navigation";
import { ADMIN_ROUTES } from "@/config/admin";
import { getAdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { formatNumber } from "@/i18n/format";
import {
  formIntent,
  readFormValues,
  rejectedForm,
  reviewForm,
  type FieldFormState,
} from "../field-form";
import { textField } from "../form";
import { requireStaff } from "../guard";
import { saveSalesSettings, SETTINGS_LIMITS } from "../sales/settings";

const TOKEN_INPUT_LENGTH = 32;

/** القديم والجديد لكل قيمة تغيّرت، بنصوص القاموس. */
function reviewLines(current: SalesSettings, next: SalesSettings): FieldFormState["review"] {
  const text = getAdminDictionary().sales.settings;
  const window = (minutes: number | null): string =>
    minutes === null
      ? text.window.unset
      : fill(text.confirm.minutes, { minutes: formatNumber(minutes) });
  const rule = (value: SalesSettings["membershipStartRule"]): string =>
    value === null ? text.startRule.unset : text.startRule.options[value];
  const lines: (readonly [string, string])[] = [];
  if (current.orderPaymentWindowMinutes !== next.orderPaymentWindowMinutes) {
    lines.push(
      [text.confirm.windowBefore, window(current.orderPaymentWindowMinutes)],
      [text.confirm.windowAfter, window(next.orderPaymentWindowMinutes)],
    );
  }
  if (current.membershipStartRule !== next.membershipStartRule) {
    lines.push(
      [text.confirm.startRuleBefore, rule(current.membershipStartRule)],
      [text.confirm.startRuleAfter, rule(next.membershipStartRule)],
    );
  }
  return lines;
}

/**
 * حفظ مهلة الطلب وقاعدة البدء بخطوتين: «راجع» تتحقق وتعيد عرض القديم والجديد ولا تكتب، و«أكّد» تحفظ
 * بما رُوجع (ومعه رمز القفل المتفائل). للمالك وحده.
 */
export async function saveSalesSettingsAction(
  previous: FieldFormState,
  formData: FormData,
): Promise<FieldFormState> {
  const context = await requireStaff("sales.settings");
  const intent = formIntent(formData);
  if (intent === "edit") {
    return rejectedForm(previous.values, { error: null, fields: {} });
  }
  const values = readFormValues(formData, SETTINGS_LIMITS);
  const lockToken = textField(formData, "lockToken", TOKEN_INPUT_LENGTH);
  const saved = await saveSalesSettings(context, { lockToken, values, intent }, new Date());
  if (!saved.ok) {
    return rejectedForm(values, saved.error);
  }
  if (saved.value.kind === "review") {
    return reviewForm(values, reviewLines(saved.value.current, saved.value.next));
  }
  redirect(`${ADMIN_ROUTES.salesSettings}?done=sales_settings_updated`);
}
