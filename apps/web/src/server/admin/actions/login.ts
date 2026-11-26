"use server";

import { revokeStaffSession } from "@masar/db";
import { redirect } from "next/navigation";
import { ADMIN_ROUTES, MAX_EMAIL_INPUT_LENGTH, MAX_PASSWORD_INPUT_LENGTH } from "@/config/admin";
import { getDb } from "../../db";
import { writeSessionCookie } from "../cookie";
import { requireAdminOpen } from "../flag";
import { failed, textField, type AdminFormState } from "../form";
import { attemptLogin } from "../login";
import { requestMeta } from "../request-meta";
import { currentStaffSession } from "../session";

/** جلسة سابقة على المتصفح نفسه تُلغى عند دخول جديد: رمز جديد لكل دخول، ولا جلسة يتيمة. */
async function revokeReplacedSession(now: Date): Promise<void> {
  const previous = await currentStaffSession();
  if (previous !== null) {
    await revokeStaffSession(getDb(), {
      sessionId: previous.session.id,
      staff: previous.staff,
      action: "session_revoked",
      at: now,
    });
  }
}

/**
 * إجراء الدخول: الوحيد تحت اللوحة بلا `requireStaff` (لا جلسة بعد)، وأول سطر فيه إغلاق اللوحة غير
 * المضبوطة. كل فشل يرجع السبب نفسه. بعد النجاح يُكتب رمز جديد ويحوَّل إلى اللوحة، والحارس يوجّه
 * الجلسة إلى خطوتها التالية (التحقق أو تغيير الكلمة أو التسجيل).
 */
export async function loginAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  requireAdminOpen();
  const now = new Date();
  const session = await attemptLogin({
    email: textField(formData, "email", MAX_EMAIL_INPUT_LENGTH),
    password: textField(formData, "password", MAX_PASSWORD_INPUT_LENGTH),
    meta: await requestMeta(),
    now,
  });
  if (session === null) {
    return failed("staff.login_failed");
  }
  await revokeReplacedSession(now);
  await writeSessionCookie(session.token, session.expiresAt);
  redirect(ADMIN_ROUTES.home);
}
