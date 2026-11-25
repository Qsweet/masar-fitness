import { expect, test } from "@playwright/test";

/** المقاسات السبعة المعتمدة للمراجعة البصرية (docs/TESTING.md). */
const WIDTHS = [360, 390, 430, 768, 1024, 1440, 1920];
const HEIGHT = 900;
/** خارج test-results (يُمسح مع كل تشغيل) وخارج git. */
const SCREENS_DIR = "screens";
const PAGES = [
  ["home", "/"],
  ["memberships", "/memberships"],
  ["plan", "/memberships/one-year"],
  ["tool", "/tools/cost-per-visit?visits=3"],
  ["blog", "/blog"],
  ["article", "/blog/training-while-fasting-ramadan-guide"],
] as const;

for (const [locale, prefix] of [
  ["ar", ""],
  ["en", "/en"],
] as const) {
  for (const [name, path] of PAGES) {
    test(`${locale} ${name}: لقطات المقاسات السبعة بلا تمرير أفقي ولا أخطاء`, async ({ page }) => {
      const problems: string[] = [];
      // مخالفات سياسة أمان المحتوى تظهر كأخطاء في console
      page.on("console", (message) => {
        if (message.type() === "error") {
          problems.push(message.text());
        }
      });
      page.on("pageerror", (error) => problems.push(error.message));
      await page.emulateMedia({ reducedMotion: "reduce" });

      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: HEIGHT });
        await page.goto(`${prefix}${path}`.replace(/(.)\/$/, "$1"), { waitUntil: "networkidle" });
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `تمرير أفقي عند ${String(width)}`).toBeLessThanOrEqual(0);
        await page.screenshot({
          path: `${SCREENS_DIR}/${locale}-${name}-${String(width)}.png`,
          fullPage: true,
        });
      }
      expect(problems).toEqual([]);
    });
  }
}
