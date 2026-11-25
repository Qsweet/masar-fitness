import AxeBuilder from "@axe-core/playwright";
import type { Db } from "@masar/db";
import { expect, test, type Page } from "@playwright/test";
import { ORDER_URL, openDemoPay, placeOrder, randomIp, testDb } from "./payments-support";

/**
 * المراجعة البصرية لصفحات الدفع (الخادم الثالث، مزوّد الاختبار): لقطات المقاسات السبعة بلا تمرير
 * أفقي ولا أخطاء في الطرفية، وفحص الوصول WCAG 2.2 AA. مرة واحدة لكل تشغيل على مشروع سطح المكتب.
 */
const WIDTHS = [360, 390, 430, 768, 1024, 1440, 1920];
const HEIGHT = 900;
const SCREENS_DIR = "screens";
const SCREENS_PROJECT = "payments-1440";
const WCAG_22_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

let db: Db;

test.beforeAll(() => {
  db = testDb();
});

test.afterAll(async () => {
  await db.$disconnect();
});

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": randomIp() });
});

async function expectAxeClean(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();
  const summary = results.violations.map(
    (violation) =>
      `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(" | ")}`,
  );
  expect(summary).toEqual([]);
}

async function captureWidths(page: Page, path: string, name: string) {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: HEIGHT });
    await page.goto(path, { waitUntil: "networkidle" });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `تمرير أفقي عند ${String(width)}: ${name}`).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `${SCREENS_DIR}/${name}-${String(width)}.png`, fullPage: true });
  }
}

for (const [locale, prefix, mismatch] of [
  ["ar", "", "دفع بمبلغ مختلف"],
  ["en", "/en", "Payment with a different amount"],
] as const) {
  test(`${locale}: لقطات صفحة الطلب بزر الدفع، وصفحة الدفع التجريبية، وحالة المراجعة`, async ({
    page,
  }) => {
    test.skip(test.info().project.name !== SCREENS_PROJECT, "اللقطات مرة واحدة لكل تشغيل");
    const problems: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        problems.push(message.text());
      }
    });
    page.on("pageerror", (error) => problems.push(error.message));
    await page.emulateMedia({ reducedMotion: "reduce" });

    const order = await placeOrder(page, db, prefix);
    await expectAxeClean(page);
    await captureWidths(page, order.orderPath, `${locale}-payment-order`);

    await openDemoPay(page);
    const demoPath = new URL(page.url()).pathname;
    await expectAxeClean(page);
    await captureWidths(page, demoPath, `${locale}-payment-demo`);

    await page.getByRole("button", { name: mismatch }).click();
    await expect(page).toHaveURL(ORDER_URL);
    await expectAxeClean(page);
    await captureWidths(page, order.orderPath, `${locale}-payment-review`);
    expect(problems).toEqual([]);
  });
}
