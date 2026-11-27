import type { Locale } from "../locales";
import { ar, type Dictionary } from "./ar";
import { en } from "./en";

const DICTIONARIES: Record<Locale, Dictionary> = { ar, en };

/**
 * القاموس كما في الكود: القيم الافتراضية وعقد الأنواع (ADMIN_A3_CONTENT §4.2). الصفحات العامة تقرأ
 * المساحات القابلة للتعديل من `getSiteContent` (الإصدار المنشور فوق هذا)؛ هذه للمساحات الممنوعة من
 * التعديل (الشراء والدفع والتنسيق)، ويفرض ذلك `content-consumers.test.ts`.
 */
export function defaultDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

export type { Dictionary };
