import "server-only";
import { findRelease } from "@masar/db";
import { isLocale, localizedPath } from "@/i18n/locales";
import { PREVIEW_DRAFT, PREVIEW_MAX_AGE_SECONDS } from "@/config/admin";
import { STATIC_PATHS } from "@/config/routes";
import { getDb } from "../../db";
import { getEnv } from "../../env";
import { previewCookieName, sealPreview } from "../../content/preview-cookie";
import { adminSecretKey } from "../flag";
import { isUuid } from "../form";
import type { StaffContext } from "../session";

/**
 * بدء المعاينة وإنهاؤها (ADMIN_A3_CONTENT §8.3). التحويل إلى صفحة عامة من القائمة المعروفة وحدها
 * (`STATIC_PATHS` بلغة معروفة): لا تحويل مفتوح بمعامل في الرابط.
 */
export function previewDestination(path: string | null, locale: string | null): string {
  const known = path !== null && STATIC_PATHS.includes(path) ? path : "/";
  return localizedPath(locale !== null && isLocale(locale) ? locale : "ar", known);
}

/** الهدف إن كان المسودة أو إصدارًا لنادي الموظف؛ وإلا null. */
export async function previewTarget(
  context: StaffContext,
  raw: string | null,
): Promise<string | null> {
  if (raw === PREVIEW_DRAFT) {
    return raw;
  }
  if (raw === null || !isUuid(raw)) {
    return null;
  }
  return (await findRelease(getDb(), context.staff.clubId, raw)) === null ? null : raw;
}

export interface PreviewCookie {
  readonly name: string;
  readonly value: string;
  readonly options: {
    readonly httpOnly: true;
    readonly secure: boolean;
    readonly sameSite: "strict";
    readonly path: "/";
    readonly maxAge: number;
  };
}

function options(maxAge: number) {
  const secure = new URL(getEnv().SITE_URL).protocol === "https:";
  return { httpOnly: true, secure, sameSite: "strict", path: "/", maxAge } as const;
}

export function previewCookie(context: StaffContext, target: string, now: Date): PreviewCookie {
  const value = sealPreview(adminSecretKey(), { staffId: context.staff.id, target }, now);
  return {
    name: previewCookieName(getEnv().SITE_URL),
    value,
    options: options(PREVIEW_MAX_AGE_SECONDS),
  };
}

export function clearedPreviewCookie(): PreviewCookie {
  return { name: previewCookieName(getEnv().SITE_URL), value: "", options: options(0) };
}

/** «انظر غيره»: التحويل بعد GET يبقى GET، ولا يُخزَّن. */
export const SEE_OTHER = 303;

/** رابط مطلق على أصل الموقع (التحويل من Route Handler يحتاج رابطًا كاملًا). */
export function siteUrl(path: string): URL {
  return new URL(path, getEnv().SITE_URL);
}
