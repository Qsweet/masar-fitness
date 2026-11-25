import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const LAB = [
  "/design-lab",
  "/design-lab/concept-01",
  "/design-lab/concept-02",
  "/design-lab/concept-03",
];
const WCAG_22_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test.describe("مختبر التصميم", () => {
  test("كل صفحاته تعمل ومغلقة عن محركات البحث بطريقتين", async ({ page }) => {
    for (const path of LAB) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
      expect(response?.headers()["x-robots-tag"], path).toBe("noindex, nofollow");
      await expect(page.locator('meta[name="robots"]'), path).toHaveAttribute("content", /noindex/);
      await expect(page.locator("html"), path).toHaveAttribute("dir", "rtl");
      await expect(page.getByRole("heading", { level: 1 }), path).toHaveCount(1);
    }
  });

  for (const path of LAB) {
    test(`لا مخالفات وصول آلية (WCAG 2.2 AA): ${path}`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();
      const summary = results.violations.map(
        (violation) =>
          `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(" | ")}`,
      );
      expect(summary).toEqual([]);
    });
  }

  test("المفاهيم تعرض أسعار القاعدة وتقود إلى صفحات الباقات الحقيقية", async ({ page }) => {
    for (const concept of ["concept-01", "concept-02"]) {
      await page.goto(`/design-lab/${concept}`);
      const plans = page.locator("#plans");
      await expect(plans, concept).toContainText("2,800");
      await expect(
        plans.locator('a[href="/memberships/one-year"]').first(),
        concept,
      ).toBeAttached();
    }
  });

  test("المفهوم 03: اختيار المدة يحدّث الملخص ورابط الشراء", async ({ page }) => {
    await page.goto("/design-lab/concept-03");
    const buy = page.locator("#buy");
    await expect(buy.getByRole("radio", { name: /12 شهرًا/ })).toBeChecked();
    await buy.getByRole("radio", { name: /3 أشهر/ }).check();
    await expect(buy.getByRole("radio", { name: /3 أشهر/ })).toBeChecked();
    await expect(buy.getByRole("radio", { name: /12 شهرًا/ })).not.toBeChecked();
    await expect(buy.locator('[aria-live="polite"]')).toContainText("900");
    await expect(buy.getByRole("link", { name: /تابع: ربع السنوية/ })).toHaveAttribute(
      "href",
      "/memberships/three-months",
    );
  });

  test("شريط الشراء الثابت مخفي فوق الواجهة ويظهر بعدها على الجوال فقط", async ({
    page,
    viewport,
  }) => {
    await page.goto("/design-lab/concept-01");
    const bar = page.getByRole("complementary", { name: "الاشتراك" });
    await expect(bar).toBeHidden();
    await page.locator("#plans").scrollIntoViewIfNeeded();
    if ((viewport?.width ?? 0) < 1024) {
      await expect(bar).toBeVisible();
    } else {
      await expect(bar).toBeHidden();
    }
  });

  test("المفهوم 03: اختيار المدة بلوحة المفاتيح", async ({ page }) => {
    await page.goto("/design-lab/concept-03");
    const buy = page.locator("#buy");
    await buy.getByRole("radio", { name: /12 شهرًا/ }).focus();
    await page.keyboard.press("ArrowLeft");
    await expect(buy.getByRole("radio", { name: /12 شهرًا/ })).not.toBeChecked();
    await expect(buy.locator('[aria-live="polite"]')).not.toContainText("2,800");
  });

  test("قائمة الجوال تعمل بلا JavaScript (details)", async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 0) >= 1024, "القائمة خاصة بالجوال");
    await page.goto("/design-lab/concept-03");
    await page.getByText("القائمة", { exact: true }).click();
    await expect(
      page.getByRole("navigation", { name: "قائمة الجوال" }).getByRole("link", { name: "المسبح" }),
    ).toBeVisible();
  });
});
