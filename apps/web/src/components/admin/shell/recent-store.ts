import { ADMIN_PATH } from "@/config/admin";

/**
 * «الأخيرة» في لوحة الأوامر (ADMIN_REDESIGN §4.1، §9-أ): روابط صفحات اللوحة فقط في تخزين هذا المتصفح،
 * بلا اسم عميل ولا بيانات. قد يكون التخزين ممنوعًا (نافذة خاصة)، فكل قراءة وكتابة تتحمل الفشل.
 */
const RECENT_KEY = "masar_admin_recent";

export function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is string => typeof item === "string" && item.startsWith(ADMIN_PATH),
        )
      : [];
  } catch {
    return [];
  }
}

export function writeRecent(recent: readonly string[]): void {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
  } catch {
    // التخزين غير متاح: «الأخيرة» تبقى فارغة ولا يتأثر شيء آخر
  }
}
