import { expect, test } from "@playwright/test";

test.describe("اللغة والاتجاه", () => {
  test("الرئيسية عربية من اليمين لليسار بلا بادئة", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("مسار الأبطال الرياضي");
    await expect(page).toHaveTitle("مسار الأبطال الرياضي");
  });

  test("الإنجليزية تحت ‎/en من اليسار لليمين", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Masters Way Sports Club");
  });

  test("التبديل بين اللغتين يعمل في الاتجاهين", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "English" }).click();
    await expect(page).toHaveURL(/\/en$/);
    await page.getByRole("link", { name: "العربية" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });

  test("بادئة ‎/ar تُحوَّل تحويلًا دائمًا إلى الرابط المعتمد", async ({ request }) => {
    for (const [from, to] of [
      ["/ar", "/"],
      ["/ar/memberships", "/memberships"],
    ] as const) {
      const response = await request.get(from, { maxRedirects: 0 });
      expect(response.status(), from).toBe(308);
      expect(new URL(response.headers().location ?? "", "http://x").pathname).toBe(to);
    }
  });

  test("مسار يبدأ بحروف لغة لكنه ليس لغة يُعامل كصفحة عربية", async ({ page }) => {
    // ‎/english و‎/arabic ليسا ‎/en و‎/ar: لا تحويل، وصفحة «غير موجودة» بالعربية
    for (const path of ["/english", "/arabic"]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
      expect(new URL(page.url()).pathname).toBe(path);
      await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    }
  });

  test("لا تمرير أفقي", async ({ page }) => {
    for (const path of ["/", "/en"]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `تمرير أفقي في ${path}`).toBeLessThanOrEqual(0);
    }
  });
});

test.describe("صفحة غير موجودة", () => {
  test("404 بالعربية واتجاهها", async ({ page }) => {
    const response = await page.goto("/no-such-page");
    expect(response?.status()).toBe(404);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("الصفحة غير موجودة");
  });

  test("404 بالإنجليزية واتجاهها", async ({ page }) => {
    const response = await page.goto("/en/no-such-page");
    expect(response?.status()).toBe(404);
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
  });
});

test.describe("الترويسات", () => {
  test("الفهرسة مغلقة افتراضيًا على كل الصفحات", async ({ request }) => {
    for (const path of ["/", "/en", "/no-such-page"]) {
      const response = await request.get(path);
      expect(response.headers()["x-robots-tag"], path).toBe("noindex, nofollow");
    }
  });

  test("الترويسات الأمنية حاضرة ولا تُكشف التقنية", async ({ request }) => {
    const headers = (await request.get("/")).headers();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["strict-transport-security"]).toContain("max-age=63072000");
    expect(headers["x-powered-by"]).toBeUndefined();
  });

  test("robots.txt لا يحجب الصفحات ويحجب الواجهات", async ({ request }) => {
    const body = await (await request.get("/robots.txt")).text();
    expect(body).toContain("Allow: /");
    expect(body).toContain("Disallow: /api/");
  });
});

test.describe("نقطة الصحة", () => {
  test("ترجع ok والإصدار حين تجيب القاعدة", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", db: "up", version: "e2e" });
    expect(response.headers()["x-app-version"]).toBe("e2e");
    expect(response.headers()["cache-control"]).toBe("no-store");
  });
});
