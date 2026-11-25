import { expect, test } from "@playwright/test";

/** الخادم الافتراضي (3100): العلم CHECKOUT_ENABLED مغلق، فالشراء غير موجود والزر واتساب كما اليوم. */
const TOKEN = "A".repeat(43);

for (const path of [
  "/checkout/one-year",
  "/en/checkout/one-year",
  `/checkout/orders/${TOKEN}`,
  `/en/checkout/orders/${TOKEN}`,
]) {
  test(`العلم مغلق ⇒ 404: ${path}`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
  });
}

for (const [prefix, label] of [
  ["", "اشترك عبر واتساب"],
  ["/en", "Join via WhatsApp"],
] as const) {
  test(`العلم مغلق ⇒ زر الباقة رابط wa.me ولا رابط إلى الشراء (${prefix || "/"})`, async ({
    page,
  }) => {
    await page.goto(`${prefix}/memberships/one-year`);
    const buy = page.locator("#plans [aria-live]").getByRole("link", { name: label });
    const href = (await buy.getAttribute("href")) ?? "";
    expect(new URL(href).origin).toBe("https://wa.me");
    await expect(page.locator('a[href*="/checkout/"]')).toHaveCount(0);
  });
}
