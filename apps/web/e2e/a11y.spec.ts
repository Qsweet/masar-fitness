import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGES = [
  "/",
  "/memberships",
  "/memberships/one-year",
  "/tools/cost-per-visit",
  "/no-such-page",
];
const WCAG_22_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

for (const prefix of ["", "/en"]) {
  for (const path of PAGES) {
    const url = `${prefix}${path}`.replace(/(.)\/$/, "$1");
    test(`لا مخالفات وصول آلية (WCAG 2.2 AA): ${url}`, async ({ page }) => {
      await page.goto(url);
      const results = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();
      const summary = results.violations.map(
        (violation) =>
          `${violation.id} (${violation.impact ?? "?"}): ${violation.nodes.map((node) => node.target.join(" ")).join(" | ")}`,
      );
      expect(summary).toEqual([]);
    });
  }
}

test("التنقل بلوحة المفاتيح: رابط التخطي أول عنصر ويظهر عند التركيز", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "انتقل إلى المحتوى" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
});
