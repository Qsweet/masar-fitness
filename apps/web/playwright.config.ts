import { defineConfig, devices } from "@playwright/test";
import { FAKE_PAYMENTS_ENV } from "./e2e/payments-env";

/** منفذ خادم الاختبار؛ يُغيَّر بـPLAYWRIGHT_PORT لتشغيل نسختين معًا على الجهاز نفسه دون تصادم. */
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
if (!Number.isInteger(PORT) || PORT <= 0) {
  throw new Error("PLAYWRIGHT_PORT must be a positive integer");
}
const BASE_URL = `http://127.0.0.1:${String(PORT)}`;
/** خادم ثانٍ من البناء نفسه والعلم CHECKOUT_ENABLED مفتوح؛ الخادم الأول يثبت أنه مغلق افتراضيًا. */
const CHECKOUT_PORT = PORT + 1;
const CHECKOUT_URL = `http://127.0.0.1:${String(CHECKOUT_PORT)}`;
/** خادم ثالث للدفع وحده: الشراء مفتوح ومزوّد الاختبار (محاكاة في الذاكرة، بلا شبكة ولا مال). */
const PAYMENTS_PORT = PORT + 2;
const PAYMENTS_URL = `http://127.0.0.1:${String(PAYMENTS_PORT)}`;
const isCi = process.env.CI !== undefined;
const SCREENS_SPEC = /screens\.spec\.ts/;
const CHECKOUT_SPEC = /[\\/]checkout(?:-no-provider)?\.spec\.ts$/;
const PAYMENTS_SPEC = /[\\/]payments(?:-[a-z]+)?\.spec\.ts$/;
/** الدفع مغلق صراحةً: متغير من بيئة الصدفة لا يضبط مزوّدًا على الخادمين الأولين. */
const PAYMENTS_OFF = { PAYMENTS_MODE: "off" };
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
      testIgnore: [SCREENS_SPEC, CHECKOUT_SPEC, PAYMENTS_SPEC],
      use: { ...devices["Desktop Chrome"], viewport: MOBILE },
    },
    {
      name: "desktop-1440",
      testIgnore: [SCREENS_SPEC, CHECKOUT_SPEC, PAYMENTS_SPEC],
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
    // مسار الدفع على الخادم الثالث (مزوّد الاختبار) فقط
    {
      name: "payments-390",
      testMatch: PAYMENTS_SPEC,
      use: { ...devices["Desktop Chrome"], viewport: MOBILE, baseURL: PAYMENTS_URL },
    },
    {
      name: "payments-1440",
      testMatch: PAYMENTS_SPEC,
      use: { ...devices["Desktop Chrome"], viewport: DESKTOP, baseURL: PAYMENTS_URL },
    },
  ],
  webServer: [
    // صراحةً: علم من بيئة الصدفة لا يفتح الشراء على الخادم الذي يثبت أنه مغلق
    server(PORT, BASE_URL, { CHECKOUT_ENABLED: "false", ...PAYMENTS_OFF }),
    server(CHECKOUT_PORT, CHECKOUT_URL, { CHECKOUT_ENABLED: "true", ...PAYMENTS_OFF }),
    server(PAYMENTS_PORT, PAYMENTS_URL, { CHECKOUT_ENABLED: "true", ...FAKE_PAYMENTS_ENV }),
  ],
});
