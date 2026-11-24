import { expect, test } from "@playwright/test";

test.describe("اللغة والاتجاه", () => {
  test("الرئيسية عربية من اليمين لليسار بلا بادئة", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("ابدأ مسارك");
  });

  test("الإنجليزية تحت ‎/en من اليسار لليمين", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Start your track");
  });

  test("تبديل اللغة يبقى على الصفحة نفسها في الاتجاهين", async ({ page }) => {
    await page.goto("/memberships/one-year");
    await page.getByRole("banner").getByRole("link", { name: "English" }).click();
    await expect(page).toHaveURL(/\/en\/memberships\/one-year$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await page.getByRole("banner").getByRole("link", { name: "العربية" }).click();
    await expect(page).toHaveURL(/\/memberships\/one-year$/);
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

  test("التحويل لا يخرج من الموقع أبدًا (لا تحويل مفتوح)", async ({ request }) => {
    for (const path of [
      "/ar//evil.example",
      "/ar/%2F%2Fevil.example",
      "/ar/%5Cevil.example",
      "/ar/\\evil.example",
    ]) {
      const response = await request.get(path, { maxRedirects: 0 });
      const location = response.headers().location;
      if (location !== undefined) {
        expect(new URL(location, "http://127.0.0.1:3100").host, `${path} ⇒ ${location}`).toBe(
          "127.0.0.1:3100",
        );
        expect(location.startsWith("//"), `${path} ⇒ ${location}`).toBe(false);
      }
    }
  });

  test("مسار يبدأ بحروف لغة لكنه ليس لغة يُعامل كصفحة عربية", async ({ page }) => {
    for (const path of ["/english", "/arabic"]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
      expect(new URL(page.url()).pathname).toBe(path);
      await expect(page.locator("html")).toHaveAttribute("lang", "ar");
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

  test("باقة غير موجودة ⇒ 404 لا صفحة فارغة", async ({ page }) => {
    const response = await page.goto("/memberships/no-such-plan");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("الصفحة غير موجودة");
  });
});

test.describe("الترويسات", () => {
  test("الفهرسة مغلقة افتراضيًا على كل الصفحات، ومنها مسار فيه نقطة", async ({ request }) => {
    for (const path of [
      "/",
      "/en",
      "/memberships",
      "/memberships/one-year",
      "/no-such-page",
      "/blog/v1.2",
    ]) {
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

  test("سياسة أمان المحتوى بـnonce مختلف لكل طلب وبلا unsafe-inline للسكربتات", async ({
    request,
  }) => {
    const policies = await Promise.all(
      [1, 2].map(async () => (await request.get("/")).headers()["content-security-policy"] ?? ""),
    );
    const nonces = policies.map((policy) => /script-src[^;]*'nonce-([^']+)'/.exec(policy)?.[1]);
    expect(nonces[0]).toBeTruthy();
    expect(nonces[0]).not.toBe(nonces[1]);
    const scriptSrc =
      policies[0]?.split("; ").find((directive) => directive.startsWith("script-src")) ?? "";
    expect(scriptSrc).not.toContain("unsafe-inline");
    expect(scriptSrc).not.toContain("unsafe-eval");
    expect(policies[0]).toContain("frame-ancestors 'none'");
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
