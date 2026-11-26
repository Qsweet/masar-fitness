/**
 * بيئة خادم لوحة التحكم في اختبارات المتصفح. المفتاح قيمة اختبار ثابتة (البايتات 0 إلى 31، وهي
 * `TEST_ADMIN_KEY` في مساعدات اختبار القاعدة) وليس سرًا: لا يُستعمل على أي خادم.
 */
export const ADMIN_E2E_KEY = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=";

export const ADMIN_ENV = { ADMIN_SECRET_KEY: ADMIN_E2E_KEY } as const;
