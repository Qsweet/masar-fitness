import { expect, test } from "@playwright/test";

/** البيانات من البذرة التجريبية (packages/db/prisma/seed-demo.ts). */
const ANNUAL = { slug: "one-year", nameAr: "السنوية", nameEn: "Annual", price: "2,800" };

test.describe("الرئيسية", () => {
  test("تعرض المدد الأربع من قاعدة البيانات، والأقل تكلفة شهريًا مختارة مع ملخصها", async ({
    page,
  }) => {
    await page.goto("/");
    const rows = page.getByRole("list", { name: "باقات الاشتراك" }).getByRole("listitem");
    await expect(rows).toHaveCount(4);

    const annual = rows.filter({ hasText: "12 شهرًا" });
    await expect(annual).toContainText(ANNUAL.price);
    await expect(annual).toContainText("+ شهران مجانًا");
    await expect(annual).toContainText("الأقل تكلفة شهريًا");
    await expect(annual.getByRole("link")).toHaveAttribute("aria-current", "true");
    await expect(rows.locator('a[aria-current="true"]')).toHaveCount(1);

    const main = page.getByRole("main");
    await expect(main).toContainText(`${ANNUAL.nameAr}: الإجمالي`);
    await expect(main).toContainText("شامل ضريبة القيمة المضافة");
    await expect(main).toContainText("حوالي 200 ر.س شهريًا");
  });

  test("اختيار مدة ينقل إلى صفحة باقتها ويحدّث الملخص", async ({ page }) => {
    await page.goto("/");
    const rows = page.getByRole("list", { name: "باقات الاشتراك" }).getByRole("listitem");
    await rows.filter({ hasText: "3 أشهر" }).getByRole("link").click();
    await expect(page).toHaveURL(/\/memberships\/three-months$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("ربع السنوية");
    await expect(page.locator('a[aria-current="true"]')).toContainText("3 أشهر");
    await expect(page.getByRole("main")).toContainText("ربع السنوية: الإجمالي");
    await expect(page.getByRole("main")).toContainText("حوالي 300 ر.س شهريًا");
  });

  test("الشاشة الأولى على الجوال: المدد الأربع بأسعارها وزر الشراء ظاهرة بلا تمرير", async ({
    page,
    viewport,
  }) => {
    test.skip((viewport?.width ?? 0) >= 768, "خاص بالجوال");
    await page.goto("/");
    const rows = page.getByRole("list", { name: "باقات الاشتراك" }).getByRole("listitem");
    for (const price of ["350", "900", "1,600", ANNUAL.price]) {
      await expect(
        rows.filter({ hasText: price }).getByText(price, { exact: true }),
      ).toBeInViewport({ ratio: 1 });
    }
    const bar = page.getByRole("complementary", { name: "ملخص الباقة والاشتراك" });
    await expect(bar.getByRole("link", { name: "اشترك عبر واتساب" })).toBeInViewport({ ratio: 1 });
    await expect(bar).toContainText(ANNUAL.price);
  });

  test("روابط الموقع الحقيقية: الاتجاهات والهاتف", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "افتح الاتجاهات" })).toHaveAttribute(
      "href",
      /google\.com\/maps\/dir\/\?api=1&destination=26\.4077931/,
    );
    await expect(
      page.getByRole("main").getByRole("link", { name: "016 324 0111" }),
    ).toHaveAttribute("href", "tel:+966163240111");
  });

  test("ترتيب العناوين سليم: عنوان رئيسي واحد", async ({ page }) => {
    for (const path of ["/", "/memberships", `/memberships/${ANNUAL.slug}`]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 }), path).toHaveCount(1);
    }
  });
});

test.describe("صفحة الباقات", () => {
  test("جدول المقارنة: عمود لكل باقة وصف لكل صفة", async ({ page }) => {
    await page.goto("/memberships");
    const table = page.getByRole("table");
    await expect(table.getByRole("columnheader")).toHaveCount(5);
    const priceRow = table.getByRole("row", { name: /السعر الإجمالي/ });
    await expect(priceRow).toContainText("350");
    await expect(priceRow).toContainText(ANNUAL.price);
    await expect(table.getByRole("row", { name: /إجمالي المدة/ })).toContainText("14 شهرًا");
    await expect(table.getByRole("row", { name: /المسبح/ }).getByText("مشمول")).toHaveCount(4);
  });
});

test.describe("صفحة الباقة", () => {
  test("الإجمالي شامل الضريبة ظاهر قبل زر الشراء", async ({ page }) => {
    await page.goto(`/memberships/${ANNUAL.slug}`);
    const main = page.getByRole("main");
    await expect(main).toContainText(`${ANNUAL.price} ر.س`);
    await expect(main).toContainText("شامل ضريبة القيمة المضافة");
    await expect(main).toContainText("14 شهرًا: 12 شهرًا مدفوعة + شهران مجانًا");
    await expect(main.getByRole("listitem").filter({ hasText: "المسبح" })).toBeVisible();
  });

  test("باقة الشهر الواحد بلا سطر «تكلفة الشهر» المكرر", async ({ page }) => {
    await page.goto("/memberships/one-month");
    const main = page.getByRole("main");
    await expect(main).toContainText("الشهرية: الإجمالي");
    await expect(main).not.toContainText("حوالي");
  });

  test("زر الشراء يفتح واتساب النادي برسالة تسمّي الباقة", async ({ page }) => {
    await page.goto(`/memberships/${ANNUAL.slug}`);
    const href = await page
      .getByRole("main")
      .getByRole("link", { name: "اشترك عبر واتساب" })
      .first()
      .getAttribute("href");
    const url = new URL(href ?? "");
    expect(`${url.origin}${url.pathname}`).toBe("https://wa.me/966553240111");
    expect(url.searchParams.get("text")).toBe(
      `مرحبًا، أرغب في الاشتراك في باقة «${ANNUAL.nameAr}».`,
    );
  });

  test("النسخة الإنجليزية بالاسم والعملة الإنجليزيين", async ({ page }) => {
    await page.goto(`/en/memberships/${ANNUAL.slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(ANNUAL.nameEn);
    await expect(page.getByRole("main")).toContainText(`${ANNUAL.price} SAR`);
    await expect(page.getByRole("main")).toContainText("14 months: 12 months paid + 2 months free");
  });

  test("الرابط المعتمد وبدائل اللغة", async ({ page }) => {
    await page.goto(`/en/memberships/${ANNUAL.slug}`);
    const origin = "http://127.0.0.1:3100";
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `${origin}/en/memberships/${ANNUAL.slug}`,
    );
    await expect(page.locator('link[rel="alternate"][hreflang="ar"]')).toHaveAttribute(
      "href",
      `${origin}/memberships/${ANNUAL.slug}`,
    );
    await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute(
      "href",
      `${origin}/memberships/${ANNUAL.slug}`,
    );
  });
});

test.describe("شريط الشراء الثابت", () => {
  test("يظهر على الجوال فقط", async ({ page, viewport }) => {
    await page.goto(`/memberships/${ANNUAL.slug}`);
    const bar = page.getByRole("complementary", { name: "ملخص الباقة والاشتراك" });
    if ((viewport?.width ?? 0) < 768) {
      await expect(bar).toBeVisible();
      await expect(bar).toContainText(ANNUAL.price);
    } else {
      await expect(bar).toBeHidden();
    }
  });
});
