import { expect, test, type Page } from "@playwright/test";

/**
 * المدونة على نسخة المعاينة (SITE_INDEXABLE غير مضبوط): المسودات الثلاث ظاهرة بشريطها وnoindex،
 * ولا تظهر أبدًا في خريطة الموقع ولا الخلاصة ولا llms.txt. السعر من البذرة التجريبية: السنوية
 * 2,800 ر.س هي الأوفر شهريًا.
 */
const SLUGS = [
  "choose-gym-membership-duration-buraidah",
  "how-much-exercise-per-week-who-guidelines",
  "training-while-fasting-ramadan-guide",
];
const ARTICLE = "/blog/training-while-fasting-ramadan-guide";
const DRAFT_BANNER = "مسودة بانتظار مراجعة المدرب";
const SOURCES_IN_ARTICLE = 10;

function articleLinks(page: Page) {
  return page.getByRole("main").getByRole("heading", { level: 3 }).getByRole("link");
}

test.describe("فهرس المدونة على المعاينة", () => {
  test("/blog يعرض المسودات الثلاث بشريط المسودة، ورابط المدونة ظاهر", async ({ page }) => {
    const response = await page.goto("/blog");
    expect(response?.status()).toBe(200);
    await expect(articleLinks(page)).toHaveCount(SLUGS.length);
    for (const slug of SLUGS) {
      await expect(page.locator(`main a[href="/blog/${slug}"]`)).toHaveCount(1);
    }
    await expect(page.getByRole("main").getByText(DRAFT_BANNER)).toHaveCount(SLUGS.length);
    // الترويسة تطوي روابطها في قائمة على الجوال؛ التذييل يعرضها في كل المقاسات
    await expect(
      page.getByRole("contentinfo").getByRole("link", { name: "المدونة" }),
    ).toBeVisible();
  });

  test("/en/blog بالإنجليزية بالمقالات نفسها", async ({ page }) => {
    await page.goto("/en/blog");
    await expect(articleLinks(page)).toHaveCount(SLUGS.length);
    await expect(
      page.locator('main a[href="/en/blog/training-while-fasting-ramadan-guide"]'),
    ).toHaveCount(1);
    await expect(page.getByRole("main").getByText("Draft awaiting the coach's review")).toHaveCount(
      SLUGS.length,
    );
  });

  test("مقال غير موجود 404", async ({ request }) => {
    expect((await request.get("/blog/any-slug")).status()).toBe(404);
  });
});

test.describe("صفحة المقال على المعاينة", () => {
  test("h1 واحد، وشريط المسودة، وصندوق الخلاصة، وnoindex", async ({ page }) => {
    const response = await page.goto(ARTICLE);
    expect(response?.status()).toBe(200);
    expect(response?.headers()["x-robots-tag"]).toContain("noindex");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveText(
      "التمرين في رمضان: متى تتمرن وكيف تحافظ على لياقتك وأنت صائم",
    );
    await expect(page.getByRole("note").filter({ hasText: DRAFT_BANNER })).toBeVisible();
    const summary = page.getByRole("region", { name: "الخلاصة" });
    await expect(summary).toContainText("أغلب الأصحاء يستطيعون الاستمرار في التمرين خلال رمضان.");
    await expect(summary.getByRole("listitem")).toHaveCount(5);
  });

  test("كل رابط في «في هذا المقال» يصل إلى قسمه", async ({ page }) => {
    await page.goto(ARTICLE);
    const links = page.getByRole("navigation", { name: "في هذا المقال" }).getByRole("link");
    const hrefs = await links.evaluateAll((anchors) =>
      anchors.map((anchor) => anchor.getAttribute("href") ?? ""),
    );
    expect(hrefs).toHaveLength(8);
    for (const href of hrefs) {
      expect(href).toMatch(/^#[a-z0-9-]+$/);
      await expect(page.locator(`section${href}`), href).toHaveCount(1);
    }
    await links.nth(4).click();
    await expect(page).toHaveURL(/#tiredness$/);
    await expect(page.locator("#tiredness-title")).toBeInViewport();
  });

  test("المراجع روابط https بـnoopener noreferrer", async ({ page }) => {
    await page.goto(ARTICLE);
    const sources = page.locator("#sources ol > li > a");
    await expect(sources).toHaveCount(SOURCES_IN_ARTICLE);
    for (const source of await sources.all()) {
      await expect(source).toHaveAttribute("href", /^https:\/\/[a-z0-9.-]+\//);
      await expect(source).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  test("التوصية تعرض السعر الحي من الكتالوج: في النص وفي النهاية", async ({ page }) => {
    await page.goto(ARTICLE);
    const recommendations = page.getByRole("complementary", { name: "اشتراك النادي الآن" });
    await expect(recommendations).toHaveCount(2);
    for (const recommendation of await recommendations.all()) {
      await expect(recommendation).toContainText("الأوفر شهريًا: السنوية");
      await expect(recommendation).toContainText("2,800");
      await expect(recommendation.getByRole("link", { name: "قارن الاشتراكات" })).toHaveAttribute(
        "href",
        "/memberships",
      );
    }
  });

  test("رابطا المرافق والمسبح إلى قسميهما في الرئيسية", async ({ page }) => {
    await page.goto("/en/blog/choose-gym-membership-duration-buraidah");
    await expect(page.getByRole("link", { name: "facilities page" })).toHaveAttribute(
      "href",
      "/en#facilities",
    );
    await page.getByRole("link", { name: "pool page" }).click();
    await expect(page).toHaveURL(/\/en#water$/);
    await expect(page.locator("#water")).toBeInViewport();
  });
});

test.describe("المسودات خارج ملفات الاكتشاف", () => {
  test("لا مسودة في sitemap.xml ولا llms.txt، والخلاصة 404 بلا منشور", async ({ request }) => {
    const sitemap = await (await request.get("/sitemap.xml")).text();
    const llms = await (await request.get("/llms.txt")).text();
    for (const slug of SLUGS) {
      expect(sitemap, slug).not.toContain(slug);
      expect(llms, slug).not.toContain(slug);
    }
    expect(sitemap).not.toContain("/blog");
    for (const feed of ["/blog/feed.xml", "/en/blog/feed.xml"]) {
      expect((await request.get(feed)).status(), feed).toBe(404);
    }
  });
});
