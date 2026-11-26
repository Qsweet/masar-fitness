import "server-only";
import { cookies } from "next/headers";
import { ADMIN_COOKIE_LOCAL, ADMIN_COOKIE_SECURE } from "@/config/admin";
import { getEnv } from "../env";

export interface AdminCookie {
  readonly name: string;
  readonly options: {
    readonly httpOnly: true;
    readonly secure: boolean;
    readonly sameSite: "strict";
    readonly path: "/";
  };
}

/**
 * كوكي جلسة الموظف (docs/ADMIN_DESIGN.md §4.5): ‎__Host-masar_admin‎ بـHttpOnly و Secure و
 * SameSite=Strict و Path=/ وبلا Domain. على http (عنوان الجهاز فقط، يفرضه الإقلاع) المتصفح يرفض
 * البادئة و Secure، فالاسم بلا بادئة.
 */
export function adminCookie(siteUrl: string): AdminCookie {
  const secure = new URL(siteUrl).protocol === "https:";
  return {
    name: secure ? ADMIN_COOKIE_SECURE : ADMIN_COOKIE_LOCAL,
    options: { httpOnly: true, secure, sameSite: "strict", path: "/" },
  };
}

export async function readSessionToken(): Promise<string | null> {
  const { name } = adminCookie(getEnv().SITE_URL);
  return (await cookies()).get(name)?.value ?? null;
}

/** يكتب رمز الجلسة. ينتهي الكوكي مع الحد المطلق للجلسة، والخادم هو الحكم في الخمول والإلغاء. */
export async function writeSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const { name, options } = adminCookie(getEnv().SITE_URL);
  (await cookies()).set(name, token, { ...options, expires: expiresAt });
}

export async function clearSessionCookie(): Promise<void> {
  const { name, options } = adminCookie(getEnv().SITE_URL);
  (await cookies()).set(name, "", { ...options, maxAge: 0 });
}
