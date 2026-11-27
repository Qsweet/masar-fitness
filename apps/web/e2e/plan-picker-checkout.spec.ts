import { expect, test } from "@playwright/test";
import { archiveLeftoverPlans } from "./plan-picker-support";

/**
 * زر بطاقة المحدِّد على خادم الشراء المفتوح (القرار 85): مشروع معزول قبل أي مشروع ينشر باقات، فيرى
 * الموقع باقات نادي المعاينة الثلاث وحدها، بـJavaScript ومن دونه.
 */
const BUY = "اشترِ الآن";
const TOTAL = "699 ر.س";

function randomIp(): string {
  const octet = () => String(Math.floor(Math.random() * 254) + 1);
  return `10.${octet()}.${octet()}.${octet()}`;
}

test.beforeAll(archiveLeftoverPlans);

test("زر البطاقة يضيف المدة المختارة إلى السلة، بـJavaScript ومن دونه", async ({ browser }) => {
  for (const javaScriptEnabled of [true, false]) {
    const context = await browser.newContext({ javaScriptEnabled, reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.setExtraHTTPHeaders({ "x-forwarded-for": randomIp() });
    await page.goto("/");
    await page.locator('#plans input[name="plan"][value="three-months"]').check();
    const card = page.locator("#plans [data-plan-card]");
    await card.getByRole("button", { name: BUY }).click();
    await expect(page).toHaveURL(/\/cart\?note=added$/);
    await expect(page.getByTestId("order-total"), String(javaScriptEnabled)).toContainText(TOTAL);
    await context.close();
  }
});
