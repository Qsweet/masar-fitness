import { expect, test } from "@playwright/test";
import {
  archiveLeftoverPlans,
  card,
  expectSelected,
  PLANS,
  radio,
  VISIBLE,
} from "./plan-picker-support";

/** محدِّد الاشتراك عبر دورة حياة الصفحة: قبل الترطيب، والرجوع والتقدم، وبلا JavaScript (القرار 79). */
test.beforeAll(archiveLeftoverPlans);

test.describe("محدِّد الاشتراك والتحميل", () => {
  test("اختيار قبل اكتمال التحميل يبقى بعد الترطيب", async ({ page }) => {
    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    // السكربتات وحدها؛ الأنماط تُحمَّل فيُرسم الاختيار بـCSS
    await page.route(/\/_next\/static\/chunks\/.*\.js$/, async (route) => {
      await gate;
      await route.continue();
    });
    // سكربتات الصفحة مؤجلة (defer) فتحجب DOMContentLoaded: يكفي وصول الصفحة ورسمها
    await page.goto("/", { waitUntil: "commit" });
    await radio(page, "three-months").check();
    await expect(page.locator("#plan-picker[data-hydrated]")).toHaveCount(0);
    await expect(card(page)).toContainText(`${PLANS[0].price} ر.س`, VISIBLE);
    release();
    await expect(page.locator("#plan-picker[data-hydrated]")).toHaveCount(1);
    await expectSelected(page, PLANS[0]);
  });

  test("الرجوع إلى الصفحة يستعيد المدة المختارة", async ({ page }) => {
    await page.goto("/");
    await radio(page, "three-months").check();
    await expectSelected(page, PLANS[0]);
    await card(page)
      .getByRole("link", { name: /تفاصيل الاشتراك/ })
      .click();
    await expect(page).toHaveURL(/\/memberships\/three-months$/);
    await page.goBack();
    await expect(page.locator("#plan-picker[data-hydrated]")).toHaveCount(1);
    await expectSelected(page, PLANS[0]);
    await page.goForward();
    await expect(page).toHaveURL(/\/memberships\/three-months$/);
  });
});

test.describe("محدِّد الاشتراك بلا JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("الراديو الأصلي يبدّل البطاقة وزر الشراء بـCSS وحده", async ({ page }) => {
    await page.goto("/memberships");
    await expectSelected(page, PLANS[2]);
    for (const plan of PLANS) {
      await radio(page, plan.slug).check();
      await expectSelected(page, plan);
    }
    // الأسهم من المتصفح نفسه
    await radio(page, "three-months").focus();
    await page.keyboard.press("ArrowLeft");
    await expectSelected(page, PLANS[1]);
    // شريط الجوال يحتاج JavaScript فيبقى مخفيًا
    await expect(page.getByRole("complementary", { name: "ملخص الاشتراك" })).toBeHidden();
  });
});
