import { expect, test } from "@playwright/test";

/**
 * اللوحة مغلقة بلا `ADMIN_SECRET_KEY` (docs/ADMIN_DESIGN.md §4.1): على الخادم الأساسي كل مسار لوحة
 * يرد 404 بصفحة «غير موجودة» العامة نفسها، ولا يُعرف من الرد أن اللوحة موجودة.
 */
const ADMIN_PATHS = ["/admin", "/admin/login", "/admin/staff", "/admin/audit", "/admin/anything"];

for (const path of ADMIN_PATHS) {
  test(`${path} يرد 404 واللوحة غير مضبوطة`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("الصفحة غير موجودة");
    await expect(page.locator("form")).toHaveCount(0);
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });
}

test("رد اللوحة المغلقة يطابق رد أي مسار مجهول", async ({ request }) => {
  const [closed, unknown] = await Promise.all([
    request.get("/admin/login", { maxRedirects: 0 }),
    request.get("/no-such-page", { maxRedirects: 0 }),
  ]);
  expect(closed.status()).toBe(404);
  expect(unknown.status()).toBe(404);
  expect(closed.headers()["x-robots-tag"]).toBe(unknown.headers()["x-robots-tag"]);
  expect(closed.headers().location).toBeUndefined();
  const title = /<title>[^<]*<\/title>/;
  expect(title.exec(await closed.text())?.[0]).toBe(title.exec(await unknown.text())?.[0]);
});

test("إرسال نموذج إلى اللوحة المغلقة يرد 404", async ({ request }) => {
  const response = await request.post("/admin/login", {
    form: { email: "owner@example.test", password: "whatever-password" },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(404);
});

test("robots.txt يمنع زحف اللوحة، وخريطة الموقع لا تذكرها", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /admin");
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).not.toContain("/admin");
});
