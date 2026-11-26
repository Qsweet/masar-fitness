"use server";

import { redirect } from "next/navigation";
import { ADMIN_ROUTES, MAX_PASSWORD_INPUT_LENGTH } from "@/config/admin";
import { writeSessionCookie } from "../cookie";
import { failed, textField, type AdminFormState } from "../form";
import { requireStaff } from "../guard";
import { changeOwnPassword } from "../password";
import type { StaffContext } from "../session";

async function change(
  context: StaffContext,
  formData: FormData,
  requireCurrent: boolean,
): Promise<AdminFormState | null> {
  const field = (name: string) => textField(formData, name, MAX_PASSWORD_INPUT_LENGTH);
  const changed = await changeOwnPassword({
    context,
    currentPassword: requireCurrent ? field("currentPassword") : null,
    newPassword: field("newPassword"),
    confirmation: field("confirmation"),
    now: new Date(),
  });
  if (!changed.ok) {
    return failed(changed.error.reason);
  }
  await writeSessionCookie(changed.value.token, changed.value.expiresAt);
  return null;
}

/** تغيير كلمة المرور المؤقتة عند أول دخول: الجلسة دخلت بها للتو، فلا تُطلب ثانية. */
export async function changeForcedPasswordAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const context = await requireStaff("account.self", "password_change");
  const failure = await change(context, formData, false);
  if (failure !== null) {
    return failure;
  }
  redirect(ADMIN_ROUTES.home);
}

/** تغيير كلمة المرور من «حسابي»: يشترط الكلمة الحالية، ويلغي الجلسات الأخرى. */
export async function changePasswordAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const context = await requireStaff("account.self");
  const failure = await change(context, formData, true);
  if (failure !== null) {
    return failure;
  }
  redirect(`${ADMIN_ROUTES.account}?done=password_changed`);
}
