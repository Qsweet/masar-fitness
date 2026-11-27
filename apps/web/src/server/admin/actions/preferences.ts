"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_DENSITY_COOKIE,
  ADMIN_PREFERENCE_MAX_AGE,
  ADMIN_ROUTES,
  ADMIN_SHORTCUTS_COOKIE,
  ADMIN_SHORTCUTS_OFF,
  ADMIN_THEME_COOKIE,
  isAdminPath,
  parseAdminDensity,
  parseAdminTheme,
} from "@/config/admin";
import { ANY_STAGE } from "../access";
import { adminCookie } from "../cookie";
import { textField } from "../form";
import { requireStaff } from "../guard";
import { getEnv } from "../../env";

const PREFERENCE_INPUT_LENGTH = 16;

/** الصفحة التي جاء منها الطلب، إن كانت داخل اللوحة؛ وإلا الرئيسية. لا تحويل إلى خارج اللوحة. */
async function returnPath(): Promise<string> {
  const referer = (await headers()).get("referer");
  if (referer === null || !URL.canParse(referer)) {
    return ADMIN_ROUTES.home;
  }
  const { pathname, search } = new URL(referer);
  return isAdminPath(pathname) ? `${pathname}${search}` : ADMIN_ROUTES.home;
}

/** تفضيل عرض في كوكي يقرؤه الخادم عند العرض (بلا وميض)، ثم العودة إلى الصفحة نفسها. */
async function rememberPreference(name: string, value: string): Promise<never> {
  const { secure } = adminCookie(getEnv().SITE_URL).options;
  (await cookies()).set(name, value, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_PREFERENCE_MAX_AGE,
  });
  redirect(await returnPath());
}

/**
 * تبديل مظهر اللوحة (داكن أو فاتح): يقرؤه التخطيط الجذري على الخادم، فتُرسم الصفحة بالمظهر من أول
 * بايت. قيمة غير معروفة تعود إلى الداكن.
 */
export async function setThemeAction(formData: FormData): Promise<void> {
  await requireStaff("account.self", ANY_STAGE);
  const theme = parseAdminTheme(textField(formData, "theme", PREFERENCE_INPUT_LENGTH));
  await rememberPreference(ADMIN_THEME_COOKIE, theme);
}

/** كثافة الجداول والحقول (مريحة أو مضغوطة). قيمة غير معروفة تعود إلى المريحة. */
export async function setDensityAction(formData: FormData): Promise<void> {
  await requireStaff("account.self");
  const density = parseAdminDensity(textField(formData, "density", PREFERENCE_INPUT_LENGTH));
  await rememberPreference(ADMIN_DENSITY_COOKIE, density);
}

/** تشغيل اختصارات الحرف الواحد أو إطفاؤها (WCAG 2.1.4). كل قيمة غير «off» تشغّلها. */
export async function setShortcutsAction(formData: FormData): Promise<void> {
  await requireStaff("account.self");
  const value = textField(formData, "shortcuts", PREFERENCE_INPUT_LENGTH);
  await rememberPreference(ADMIN_SHORTCUTS_COOKIE, value === ADMIN_SHORTCUTS_OFF ? "off" : "on");
}
