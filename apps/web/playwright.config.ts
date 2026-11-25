import { defineConfig, devices } from "@playwright/test";

/** منفذ خادم الاختبار؛ يُغيَّر بـPLAYWRIGHT_PORT لتشغيل نسختين معًا على الجهاز نفسه دون تصادم. */
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
if (!Number.isInteger(PORT) || PORT <= 0) {
  throw new Error("PLAYWRIGHT_PORT must be a positive integer");
}
const BASE_URL = `http://127.0.0.1:${String(PORT)}`;
/** خادم ثانٍ من البناء نفسه والعلم CHECKOUT_ENABLED مفتوح؛ الخادم الأول يثبت أنه مغلق افتراضيًا. */
const CHECKOUT_PORT = 3101;
const CHECKOUT_URL = `http://127.0.0.1:${String(CHECKOUT_PORT)}`;
const isCi = process.env.CI !== undefined;
const SCREENS_SPEC = /screens\.spec\.ts/;
const CHECKOUT_SPEC = /[\\/]checkout\.spec\.ts$/;
const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

function server(port: number, url: string, env: Record<string, string>) {
  return {
    command: `pnpm exec next start --port ${String(port)} --hostname 127.0.0.1`,
    url: `${url}/api/health`,
    reuseExistingServer: !isCi,
    env: { SITE_URL: url, APP_VERSION: "e2e", ...env },
  };
}

/**
 * اختبارات المتصفح تعمل على البناء الإنتاجي (`next build` أولًا) وقاعدة الاختبار ببياناتها التجريبية
 * (`pnpm db:seed:demo`). الخادم مربوط بـ127.0.0.1 كما في النشر الفعلي (القرار 8).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  reporter: isCi ? [["github"], ["list"]] : "list",
  use: { baseURL: BASE_URL },
  projects: [
    {
      name: "mobile-390",
      testIgnore: [SCREENS_SPEC, CHECKOUT_SPEC],
      use: { ...devices["Desktop Chrome"], viewport: MOBILE },
    },
    {
      name: "desktop-1440",
      testIgnore: [SCREENS_SPEC, CHECKOUT_SPEC],
      use: { ...devices["Desktop Chrome"], viewport: DESKTOP },
    },
    // المقاسات السبعة للمراجعة البصرية: يغيّر الاختبار المقاس بنفسه ويحفظ اللقطات
    { name: "screens", testMatch: SCREENS_SPEC, use: { ...devices["Desktop Chrome"] } },
    // مسار الشراء على الخادم الثاني (العلم مفتوح) فقط
    {
      name: "checkout-390",
      testMatch: CHECKOUT_SPEC,
      use: { ...devices["Desktop Chrome"], viewport: MOBILE, baseURL: CHECKOUT_URL },
    },
    {
      name: "checkout-1440",
      testMatch: CHECKOUT_SPEC,
      use: { ...devices["Desktop Chrome"], viewport: DESKTOP, baseURL: CHECKOUT_URL },
    },
  ],
  webServer: [
    // صراحةً: علم من بيئة الصدفة لا يفتح الشراء على الخادم الذي يثبت أنه مغلق
    server(PORT, BASE_URL, { CHECKOUT_ENABLED: "false" }),
    server(CHECKOUT_PORT, CHECKOUT_URL, { CHECKOUT_ENABLED: "true" }),
  ],
});
