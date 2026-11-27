import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * بيئة خادم لوحة التحكم في اختبارات المتصفح. المفتاح قيمة اختبار ثابتة (البايتات 0 إلى 31، وهي
 * `TEST_ADMIN_KEY` في مساعدات اختبار القاعدة) وليس سرًا: لا يُستعمل على أي خادم.
 */
export const ADMIN_E2E_KEY = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=";

export const ADMIN_ENV = { ADMIN_SECRET_KEY: ADMIN_E2E_KEY } as const;

/**
 * مكتبة الصور على خادم اللوحة (ADMIN_A3_SLIDER §6.4): مجلد مؤقت خارج المستودع لكل منفذ، والرفع مفتوح،
 * والنسخ الاحتياطي غير معلن فيظهر تنبيهه.
 */
export function mediaEnv(port: number) {
  return {
    MEDIA_DIR: join(tmpdir(), `masar-e2e-media-${String(port)}`),
    MEDIA_UPLOADS: "yes",
    BACKUP_CONFIGURED: "",
  } as const;
}
