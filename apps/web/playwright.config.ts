import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${String(PORT)}`;
const isCi = process.env.CI !== undefined;

/**
 * اختبارات المتصفح تعمل على البناء الإنتاجي (`next build` أولًا) وقاعدة الاختبار.
 * المقاسات هنا للدخان فقط؛ المقاسات السبعة للمراجعة البصرية تُضاف مع الواجهات في المرحلة 2.
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
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },
    },
    {
      name: "desktop-1440",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: `pnpm exec next start --port ${String(PORT)} --hostname 127.0.0.1`,
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: !isCi,
    env: {
      SITE_URL: BASE_URL,
      APP_VERSION: "e2e",
    },
  },
});
