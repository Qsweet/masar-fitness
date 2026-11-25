import { expect, test, type Page } from "@playwright/test";

/** الأرقام من البذرة التجريبية: الشهرية 350 ر.س، والسنوية 2800 ر.س لـ12 شهرًا + شهرين. */
const TOOL = "/tools/cost-per-visit";

function result(page: Page) {
  return page.getByRole("region", { name: /إذا تمرنت|If you train/ });
}

test.describe("حاسبة تكلفة الزيارة", () => {
  test("‎?visits=3‎: نتيجة على الخادم لكل اشتراك، والأوفر معلَّم", async ({ page }) => {
    const response = await page.goto(`${TOOL}?visits=3`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("كم تكلفك الزيارة؟");
    await expect(result(page).getByRole("heading", { level: 2 })).toHaveText(
      "إذا تمرنت 3 مرات في الأسبوع",
    );
    await expect(result(page).getByRole("listitem")).toHaveCount(4);
    const annual = result(page).getByRole("listitem").filter({ hasText: "السنوية" }).last();
    await expect(annual).toContainText("15.38");
    await expect(annual).toContainText("2,800");
    await expect(annual).toContainText("الأوفر شهريًا");
    await expect(
      result(page).getByRole("listitem").filter({ hasText: "الشهرية" }).first(),
    ).toContainText("26.92");
    await expect(page.getByRole("radio", { name: "3" })).toBeChecked();
    await expect(result(page)).toContainText("الرقم تقريبي");
  });

  test("قيمة غير صالحة ⇒ الافتراضية بلا عطل", async ({ page }) => {
    for (const query of [
      "?visits=abc",
      "?visits=0",
      "?visits=99",
      "?visits=2&visits=5",
      "?visits=%00",
    ]) {
      const response = await page.goto(`${TOOL}${query}`);
      expect(response?.status(), query).toBe(200);
      await expect(page.getByRole("radio", { name: "3" }), query).toBeChecked();
    }
  });

  test("النموذج يعمل بلا JavaScript ويعطي رابطًا قابلًا للمشاركة", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(TOOL);
    await page.getByRole("radio", { name: "7" }).check();
    await page.getByRole("button", { name: "احسب" }).click();
    await expect(page).toHaveURL(/\/tools\/cost-per-visit\?visits=7$/);
    await expect(
      result(page).getByRole("listitem").filter({ hasText: "السنوية" }).last(),
    ).toContainText("6.59");
    await context.close();
  });

  test("الإنجليزية: once وtwice", async ({ page }) => {
    await page.goto(`/en${TOOL}?visits=2`);
    await expect(result(page).getByRole("heading", { level: 2 })).toHaveText(
      "If you train twice a week",
    );
  });

  test("الرابط المعتمد بلا معامل الرابط", async ({ page, baseURL }) => {
    await page.goto(`${TOOL}?visits=5`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `${baseURL ?? ""}${TOOL}`,
    );
  });

  // فحص الوصول الآلي للحاسبة باللغتين في a11y.spec.ts مع بقية الصفحات

  test("روابط الحاسبة في التذييل وصفحة الاشتراكات", async ({ page }) => {
    await page.goto("/memberships");
    await expect(page.getByRole("main").getByRole("link", { name: /احسبها/ })).toHaveAttribute(
      "href",
      TOOL,
    );
    await expect(
      page.getByRole("contentinfo").getByRole("link", { name: "حاسبة تكلفة الزيارة" }),
    ).toHaveAttribute("href", TOOL);
  });
});

test.describe("المدونة بلا مقالات", () => {
  test("الفهرس والخلاصة 404، ولا رابط للمدونة", async ({ page, request }) => {
    for (const path of [
      "/blog",
      "/en/blog",
      "/blog/feed.xml",
      "/en/blog/feed.xml",
      "/blog/any-slug",
    ]) {
      expect((await request.get(path)).status(), path).toBe(404);
    }
    await page.goto("/");
    await expect(page.getByRole("link", { name: "المدونة" })).toHaveCount(0);
  });
});

test.describe("ملفات الاكتشاف", () => {
  test("sitemap.xml: الروابط المعتمدة باللغتين وبلا مدونة", async ({ request, baseURL }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("xml");
    const xml = await response.text();
    const origin = baseURL ?? "";
    for (const url of [
      `${origin}/`,
      `${origin}/en`,
      `${origin}/memberships/one-year`,
      `${origin}${TOOL}`,
    ]) {
      expect(xml, url).toContain(`<loc>${url}</loc>`);
    }
    expect(xml).toContain('hreflang="x-default"');
    expect(xml).not.toContain("/blog");
  });

  test("robots.txt: يسمح بالزحف ويشير إلى خريطة الموقع", async ({ request, baseURL }) => {
    const body = await (await request.get("/robots.txt")).text();
    expect(body).toContain("Allow: /");
    expect(body).toContain(`Sitemap: ${baseURL ?? ""}/sitemap.xml`);
    expect(body).not.toMatch(/Disallow: \/\s*$/m);
  });

  test("llms.txt: نص عادي بحقائق النادي", async ({ request, baseURL }) => {
    const response = await request.get("/llms.txt");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/plain");
    const body = await response.text();
    expect(body.startsWith("# مسار الأبطال الرياضي")).toBe(true);
    expect(body).toContain(`${baseURL ?? ""}/memberships`);
  });

  test("JSON-LD في الرئيسية: JSON صالح بالنادي مكانًا، ويحمل nonce الطلب", async ({
    page,
    request,
  }) => {
    await page.goto("/");
    const scripts = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(scripts).toHaveLength(1);
    const data = JSON.parse(scripts[0] ?? "") as { "@graph": { "@type": string }[] };
    expect(data["@graph"].map((node) => node["@type"])).toEqual([
      "Organization",
      "ExerciseGym",
      "WebSite",
    ]);

    const response = await request.get("/");
    const csp = response.headers()["content-security-policy"] ?? "";
    const nonce = /'nonce-([^']+)'/.exec(csp)?.[1] ?? "missing";
    expect(await response.text()).toContain(`<script type="application/ld+json" nonce="${nonce}">`);
  });
});
