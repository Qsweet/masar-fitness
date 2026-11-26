import { expect, test } from "@playwright/test";

test.describe("التذييل", () => {
  test("شعارات طرق الدفع الرسمية ظاهرة بأسمائها، والتحويل البنكي باسمه", async ({ page }) => {
    await page.goto("/memberships");
    const payments = page.getByRole("contentinfo").getByRole("list", { name: "طرق الدفع" });
    for (const name of ["مدى", "Apple Pay", "تابي", "تمارا"]) {
      const logo = payments.getByRole("img", { name, exact: true });
      await logo.scrollIntoViewIfNeeded();
      await expect(logo).toBeVisible();
      // الصورة محمّلة فعلًا لا رابطًا مكسورًا (التحميل كسول، فننتظره بعد التمرير إليها)
      await expect
        .poll(() => logo.evaluate((img: HTMLImageElement) => img.naturalWidth))
        .toBeGreaterThan(0);
    }
    await expect(payments).toContainText("تحويل بنكي");
  });

  test("أوقات النادي في التذييل من الإعداد نفسه", async ({ page }) => {
    await page.goto("/en/memberships");
    const footer = page.getByRole("contentinfo");
    await expect(footer.getByRole("heading", { name: "Club hours" })).toBeVisible();
    await expect(footer.getByRole("img", { name: "Tabby", exact: true })).toBeVisible();
  });
});
