"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_PREFERENCE_MAX_AGE,
  ADMIN_ROUTES,
  ADMIN_THEME_COOKIE,
  isAdminPath,
  parseAdminTheme,
} from "@/config/admin";
import { ANY_STAGE } from "../access";
import { adminCookie } from "../cookie";
import { textField } from "../form";
import { requireStaff } from "../guard";
import { getEnv } from "../../env";

const THEME_INPUT_LENGTH = 8;

/** الصفحة التي جاء منها الطلب، إن كانت داخل اللوحة؛ وإلا الرئيسية. لا تحويل إلى خارج اللوحة. */
async function returnPath(): Promise<string> {
  const referer = (await headers()).get("referer");
  if (referer === null || !URL.canParse(referer)) {
    return ADMIN_ROUTES.home;
  }
  const { pathname, search } = new URL(referer);
  return isAdminPath(pathname) ? `${pathname}${search}` : ADMIN_ROUTES.home;
}

/**
 * تبديل مظهر اللوحة (داكن أو فاتح): تفضيل عرض يُحفظ في كوكي يقرؤه التخطيط الجذري على الخادم، فتُرسم
 * الصفحة بالمظهر من أول بايت. قيمة غير معروفة تعود إلى الداكن.
 */
export async function setThemeAction(formData: FormData): Promise<void> {
  await requireStaff("account.self", ANY_STAGE);
  const theme = parseAdminTheme(textField(formData, "theme", THEME_INPUT_LENGTH));
  const { secure } = adminCookie(getEnv().SITE_URL).options;
  (await cookies()).set(ADMIN_THEME_COOKIE, theme, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_PREFERENCE_MAX_AGE,
  });
  redirect(await returnPath());
}
