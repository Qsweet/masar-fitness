import { expect, test } from "@playwright/test";
import { publicText } from "./public-text";

/**
 * الموقع العام بلا إصدار محتوى منشور يعرض النص نفسه حرفًا بحرف (ADMIN_A3_CONTENT §11، WP2): اللقطات
 * أُخذت من البناء قبل إعادة ربط القواميس بالمُحلِّل، وأي فرق في نص صفحة أو وصفها أو بياناتها المنظَّمة
 * يُسقط الاختبار. مقاس واحد: النص لا يتغير بالمقاس، واللقطات البصرية في `screens.spec.ts`.
 */
const PAGES = [
  ["home", "/"],
  ["memberships", "/memberships"],
  ["plan", "/memberships/one-year"],
  ["tool", "/tools/cost-per-visit"],
  ["blog", "/blog"],
  ["article", "/blog/training-while-fasting-ramadan-guide"],
  ["not-found", "/no-such-page"],
] as const;

const TEXT_ROUTES = [
  ["llms", "/llms.txt"],
  ["feed-ar", "/blog/feed.xml"],
  ["feed-en", "/en/blog/feed.xml"],
  ["robots", "/robots.txt"],
] as const;

// النص كما يرسله الخادم، بلا ما يرسمه JavaScript بعد التحميل (زر الفيديو)، فلا تتغير اللقطة بالتوقيت
test.use({ javaScriptEnabled: false });

const DESKTOP_WIDTH = 1440;
test.skip(({ viewport }) => viewport?.width !== DESKTOP_WIDTH, "النص لا يتغير بالمقاس");

for (const [locale, prefix] of [
  ["ar", ""],
  ["en", "/en"],
] as const) {
  for (const [name, path] of PAGES) {
    test(`${locale} ${name}: النص كما كان قبل طبقة المحتوى`, async ({ page }) => {
      await page.goto(`${prefix}${path}`.replace(/(.)\/$/, "$1"));
      const text = await publicText(page);
      expect(`${JSON.stringify(text, null, 1)}\n`).toMatchSnapshot(`${locale}-${name}.json`);
    });
  }
}

for (const [name, path] of TEXT_ROUTES) {
  test(`${name}: النص كما كان قبل طبقة المحتوى`, async ({ request }) => {
    const response = await request.get(path, { maxRedirects: 0 });
    const body = `${String(response.status())}\n${await response.text()}`;
    expect(body).toMatchSnapshot(`${name}.txt`);
  });
}
