import type { Widen } from "../dictionaries/widen";
import { adminAr } from "./ar";

/**
 * قاموس لوحة التحكم، منفصل عن قاموس الموقع العام فلا يدخل حزمته. اللوحة عربية اليوم؛ إضافة لغة =
 * ملف بشكل `AdminDictionary` وسطر في `ADMIN_LOCALES` و`DICTIONARIES`.
 */
export const ADMIN_LOCALES = ["ar"] as const;
export type AdminLocale = (typeof ADMIN_LOCALES)[number];
export const ADMIN_DEFAULT_LOCALE: AdminLocale = "ar";

export type AdminDictionary = Widen<typeof adminAr>;

const DICTIONARIES: Record<AdminLocale, AdminDictionary> = { ar: adminAr };
const DIRECTIONS: Record<AdminLocale, "rtl" | "ltr"> = { ar: "rtl" };

export function getAdminDictionary(locale: AdminLocale = ADMIN_DEFAULT_LOCALE): AdminDictionary {
  return DICTIONARIES[locale];
}

export function adminDirection(locale: AdminLocale = ADMIN_DEFAULT_LOCALE): "rtl" | "ltr" {
  return DIRECTIONS[locale];
}

/** نص من خريطة قاموس بمفتاح يكتبه الكود (سبب خطأ، حدث تدقيق)؛ البديل حين لا ترجمة له. */
export function lookup(
  map: Readonly<Record<string, string>>,
  key: string,
  fallback: string,
): string {
  return Object.hasOwn(map, key) ? (map[key] ?? fallback) : fallback;
}
