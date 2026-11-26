import { expect, test } from "@playwright/test";

test.describe("موضع التمرير عند الانتقال", () => {
  test("رابط في التذييل يفتح الصفحة الجديدة من أعلاها، والرجوع يعيد الموضع السابق", async ({
    page,
  }) => {
    await page.goto("/memberships");
    const footerLink = page
      .getByRole("contentinfo")
      .getByRole("link", { name: "الرئيسية", exact: true });
    await footerLink.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => window.scrollY);
    expect(before).toBeGreaterThan(0);

    await footerLink.click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

    await page.goBack();
    await expect(page).toHaveURL(/\/memberships$/);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  });

  test("رابط إلى قسم في صفحة أخرى ينقل إلى القسم لا إلى أعلى الصفحة", async ({ page }) => {
    await page.goto("/memberships");
    await page.getByRole("contentinfo").getByRole("link", { name: "المرافق", exact: true }).click();
    await expect(page).toHaveURL(/\/#facilities$/);
    await expect(page.locator("#facilities")).toBeInViewport();
  });
});
