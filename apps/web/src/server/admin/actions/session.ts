"use server";

import { revokeStaffSession } from "@masar/db";
import { redirect } from "next/navigation";
import { ADMIN_ROUTES } from "@/config/admin";
import { getDb } from "../../db";
import { ANY_STAGE } from "../access";
import { clearSessionCookie } from "../cookie";
import { clearFlash } from "../flash";
import { idField } from "../form";
import { requireStaff } from "../guard";

/** الخروج: يلغي الجلسة في القاعدة ويمحو الكوكي. متاح في كل مرحلة. */
export async function logoutAction(): Promise<void> {
  const { staff, session } = await requireStaff("account.self", ANY_STAGE);
  await revokeStaffSession(getDb(), {
    sessionId: session.id,
    staff,
    action: "logout",
    at: new Date(),
  });
  await clearSessionCookie();
  await clearFlash();
  redirect(ADMIN_ROUTES.login);
}

/** «جلساتي»: إلغاء جلسة يملكها الموظف. إلغاء الجلسة الحالية خروج. */
export async function revokeSessionAction(formData: FormData): Promise<void> {
  const { staff, session } = await requireStaff("account.self");
  const sessionId = idField(formData, "sessionId");
  if (sessionId !== null) {
    await revokeStaffSession(getDb(), {
      sessionId,
      staff,
      action: "session_revoked",
      at: new Date(),
    });
  }
  if (sessionId === session.id) {
    await clearSessionCookie();
    redirect(ADMIN_ROUTES.login);
  }
  redirect(`${ADMIN_ROUTES.account}?done=session_revoked`);
}
