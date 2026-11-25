import { expect, test, type Page } from "@playwright/test";

/**
 * المدونة على نسخة المعاينة (SITE_INDEXABLE غير مضبوط): المسودات الثلاث ظاهرة بشريطها وnoindex،
 * ولا تظهر أبدًا في خريطة الموقع ولا الخلاصة ولا llms.txt. السعر من بذرة المعاينة: «12 شهرًا + شهرين
 * مجانًا» 1,499 ر.س هي الأوفر شهريًا.
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
    // تنبيه واحد أعلى الفهرس بدل شارة وتاريخ على كل بطاقة، وكل بطاقة بصورة ووسم موضوعها
    const notice = page.getByRole("main").getByRole("note");
    await expect(notice).toHaveCount(1);
    await expect(notice).toContainText("المقالات هنا مسودات لم يراجعها المدرب بعد.");
    await expect(notice.locator("time")).toHaveCount(1);
    const cards = page.getByRole("main").locator("li", { has: page.getByRole("heading") });
    await expect(cards).toHaveCount(SLUGS.length);
    await expect(cards.locator("img")).toHaveCount(SLUGS.length);
    await expect(cards.locator("time")).toHaveCount(0);
    await expect(cards.first()).toContainText("اختيار الاشتراك");
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
    await expect(page.getByRole("main").getByRole("note")).toContainText(
      "The articles here are drafts the coach has not reviewed yet.",
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
      await expect(recommendation).toContainText("الأوفر شهريًا: 12 شهرًا + شهران مجانًا");
      await expect(recommendation).toContainText("1,499");
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

interface JsonLdGraph {
  readonly "@graph": readonly { "@type": string; itemListElement?: { name: string }[] }[];
}

test.describe("دلالات صفحة المقال", () => {
  const MEMBERSHIP = "/blog/choose-gym-membership-duration-buraidah";

  test("الجدول يبقى جدولًا بأدوار صريحة حتى حين يتكدس بطاقاتٍ على الجوال", async ({ page }) => {
    await page.goto(MEMBERSHIP);
    const table = page.locator('main table[role="table"]');
    await expect(table).toHaveCount(1);
    await expect(table.locator('[role="rowgroup"]')).toHaveCount(2);
    await expect(table.locator('tr[role="row"]')).toHaveCount(5);
    await expect(table.locator('th[role="columnheader"]')).toHaveCount(3);
    await expect(table.locator('th[role="rowheader"]')).toHaveCount(4);
    await expect(table.locator('td[role="cell"]')).toHaveCount(8);
    await expect(page.getByRole("table")).toHaveCount(1);
    await expect(page.getByRole("rowheader", { name: "منتظم منذ أشهر وتعرف جدولك" })).toBeVisible();
  });

  test("عنوان المرجع بلغة أخرى يحمل lang (WCAG 3.1.2)", async ({ page }) => {
    await page.goto(ARTICLE);
    await expect(page.locator('#sources a > bdi[lang="en"]')).toHaveCount(8);
    await expect(page.locator('#sources a > bdi[lang="ar"]')).toHaveCount(2);
    await page.goto(`/en${ARTICLE}`);
    const arabicTitle = page.locator('#sources a > bdi[lang="ar"]');
    await expect(arabicTitle).toHaveCount(2);
    await expect(arabicTitle.first()).toHaveText("الرياضة في رمضان: عزِّز صحتك ولا ترهقها");
    // ناشر وزارة الصحة مكتوب بلغة الصفحة فلا يُعلَّم بلغة أخرى
    await expect(page.locator('#sources bdi[lang="ar"]')).toHaveCount(2);
  });

  test("مسار التنقل الظاهر هو BreadcrumbList نفسه، آخره الصفحة الحالية", async ({ page }) => {
    await page.goto(MEMBERSHIP);
    const items = page.getByRole("navigation", { name: "مسار التنقل" }).getByRole("listitem");
    const scripts = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((elements) => elements.map((element) => element.textContent));
    const graph = scripts
      .map((text) => JSON.parse(text) as Partial<JsonLdGraph>)
      .flatMap((data) => data["@graph"] ?? []);
    const crumbs = graph.find((node) => node["@type"] === "BreadcrumbList");
    const names = (crumbs?.itemListElement ?? []).map((item) => item.name);
    expect(names).toHaveLength(3);
    await expect(items).toHaveText(names);
    const current = items.last();
    await expect(current).toHaveAttribute("aria-current", "page");
    await expect(current).toHaveText(await page.locator("h1").innerText());
    await expect(current.getByRole("link")).toHaveCount(0);
    // isPartOf يشير إلى عقدة WebSite معلنة في الصفحة نفسها
    expect(graph.some((node) => node["@type"] === "WebSite")).toBe(true);
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
