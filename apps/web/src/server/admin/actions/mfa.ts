"use server";

import { redirect } from "next/navigation";
import { ADMIN_ROUTES, MAX_CODE_INPUT_LENGTH } from "@/config/admin";
import { writeSessionCookie } from "../cookie";
import { clearFlash, writeFlash } from "../flash";
import { failed, textField, type AdminFormState } from "../form";
import { requireStaff } from "../guard";
import { confirmEnrolment, verifySecondStep, type MfaMethod } from "../mfa";
import { requestMeta } from "../request-meta";
import type { StaffContext } from "../session";

async function verify(
  context: StaffContext,
  method: MfaMethod,
  formData: FormData,
): Promise<AdminFormState> {
  const session = await verifySecondStep({
    context,
    method,
    input: textField(formData, "code", MAX_CODE_INPUT_LENGTH),
    meta: await requestMeta(),
    now: new Date(),
  });
  if (session === null) {
    return failed("staff.mfa_failed");
  }
  await writeSessionCookie(session.token, session.expiresAt);
  redirect(ADMIN_ROUTES.home);
}

/** الخطوة الثانية برمز التطبيق. */
export async function verifyTotpAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const context = await requireStaff("account.self", "mfa_verify");
  return verify(context, "totp", formData);
}

/** الخطوة الثانية برمز استرجاع (يُستهلك). */
export async function verifyRecoveryAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const context = await requireStaff("account.self", "mfa_verify");
  return verify(context, "recovery", formData);
}

/** تأكيد تسجيل الخطوة الثانية: يفعّلها ويحوّل إلى صفحة رموز الاسترجاع (تُعرض مرة). */
export async function confirmEnrolAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const context = await requireStaff("account.self", "mfa_enrol");
  const done = await confirmEnrolment({
    context,
    input: textField(formData, "code", MAX_CODE_INPUT_LENGTH),
    meta: await requestMeta(),
    now: new Date(),
  });
  if (done === null) {
    return failed("staff.mfa_failed");
  }
  await writeSessionCookie(done.token, done.expiresAt);
  await writeFlash(context.staff.id, {
    kind: "recovery_codes",
    subject: context.staff.id,
    values: [...done.recoveryCodes],
  });
  redirect(ADMIN_ROUTES.recoveryCodes);
}

/** الموظف أكد أنه حفظ رموز الاسترجاع: تُمحى من المتصفح ويدخل اللوحة. */
export async function acknowledgeRecoveryCodesAction(): Promise<void> {
  await requireStaff("account.self");
  await clearFlash();
  redirect(ADMIN_ROUTES.home);
}
