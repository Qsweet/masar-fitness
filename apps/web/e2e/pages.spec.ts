import { expect, test, type Page } from "@playwright/test";

/** البيانات من البذرة التجريبية (packages/db/prisma/seed-demo.ts). */
const ANNUAL = { slug: "one-year", nameAr: "السنوية", nameEn: "Annual", price: "2,800" };
const BAR = "ملخص الاشتراك";

function durations(page: Page) {
  return page.getByRole("group", { name: "مدة الاشتراك" });
}

function summary(page: Page) {
  return page.locator("#plans [aria-live]");
}

test.describe("الرئيسية", () => {
  test("تعرض المدد الأربع من القاعدة، والأوفر شهريًا مختار مع ملخصه", async ({ page }) => {
    await page.goto("/");
    const options = durations(page).getByRole("radio");
    await expect(options).toHaveCount(4);
    const annual = durations(page).locator("label").filter({ hasText: "شهرًا" });
    await expect(annual).toContainText(ANNUAL.price);
    await expect(annual).toContainText("+ شهران مجانًا");
    await expect(annual).toContainText("الأوفر شهريًا");
    await expect(annual.getByRole("radio")).toBeChecked();

    await expect(summary(page)).toContainText(ANNUAL.nameAr);
    await expect(summary(page)).toContainText(`${ANNUAL.price} ر.س`);
    await expect(summary(page)).toContainText("شامل ضريبة القيمة المضافة");
    await expect(summary(page)).toContainText("14 شهرًا: 12 شهرًا + شهران مجانًا");
    await expect(summary(page)).toContainText("حوالي 200 ر.س للشهر");
  });

  test("اختيار مدة يحدّث الملخص فورًا بلا انتقال", async ({ page }) => {
    await page.goto("/");
    await durations(page)
      .locator("label")
      .filter({ hasText: "أشهر" })
      .first()
      .getByRole("radio")
      .check();
    await expect(page).toHaveURL(/\/$/);
    await expect(summary(page)).toContainText("ربع السنوية");
    await expect(summary(page)).toContainText("900 ر.س");
    await expect(summary(page)).toContainText("حوالي 300 ر.س للشهر");
    await summary(page)
      .getByRole("link", { name: /تفاصيل الاشتراك/ })
      .click();
    await expect(page).toHaveURL(/\/memberships\/three-months$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("ربع السنوية");
  });

  test("الاختيار بلوحة المفاتيح: الأسهم تنقل بين المدد", async ({ page }) => {
    await page.goto("/");
    await durations(page).getByRole("radio", { checked: true }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(durations(page).getByRole("radio", { checked: true })).toBeFocused();
    await expect(durations(page).getByRole("radio", { checked: true })).not.toHaveValue(
      ANNUAL.slug,
    );
    await expect(summary(page)).toContainText("نصف السنوية");
  });

  test("روابط الموقع الحقيقية: الخريطة والهاتف", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "افتح الخريطة" })).toHaveAttribute(
      "href",
      /google\.com\/maps\/dir\/\?api=1&destination=26\.4077931/,
    );
    await expect(
      page.getByRole("main").getByRole("link", { name: "اتصل 016 324 0111" }),
    ).toHaveAttribute("href", "tel:+966163240111");
  });

  test("ترتيب العناوين سليم: عنوان رئيسي واحد", async ({ page }) => {
    for (const path of ["/", "/memberships", `/memberships/${ANNUAL.slug}`]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 }), path).toHaveCount(1);
    }
  });
});

test.describe("صفحة الاشتراكات", () => {
  test("جدول المقارنة: عمود لكل اشتراك وصف لكل صفة", async ({ page }) => {
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

test.describe("صفحة الاشتراك", () => {
  test("اشتراك الصفحة مختار، والإجمالي ظاهر قبل زر الشراء", async ({ page }) => {
    await page.goto("/memberships/three-months");
    await expect(durations(page).getByRole("radio", { checked: true })).toHaveValue("three-months");
    await expect(summary(page)).toContainText("900 ر.س");
    await expect(summary(page).getByRole("link", { name: /تفاصيل الاشتراك/ })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "يشمل الاشتراك" })).toBeVisible();
  });

  test("اشتراك الشهر الواحد بلا سطر «تكلفة الشهر» المكرر", async ({ page }) => {
    await page.goto("/memberships/one-month");
    await expect(summary(page)).toContainText("الشهرية");
    await expect(summary(page)).not.toContainText("حوالي");
  });

  test("زر الشراء يفتح واتساب النادي برسالة تسمّي الاشتراك", async ({ page }) => {
    await page.goto(`/memberships/${ANNUAL.slug}`);
    const href = await summary(page)
      .getByRole("link", { name: "اشترك عبر واتساب" })
      .getAttribute("href");
    const url = new URL(href ?? "");
    expect(`${url.origin}${url.pathname}`).toBe("https://wa.me/966553240111");
    expect(url.searchParams.get("text")).toBe(`مرحبًا، أرغب في اشتراك «${ANNUAL.nameAr}».`);
  });

  test("النسخة الإنجليزية بالاسم والعملة الإنجليزيين", async ({ page }) => {
    await page.goto(`/en/memberships/${ANNUAL.slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(ANNUAL.nameEn);
    await expect(summary(page)).toContainText(`${ANNUAL.price} SAR`);
    await expect(summary(page)).toContainText("14 months: 12 months + 2 months free");
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
  test("على الجوال: مخفي في الواجهة، ويظهر بعدها بالاشتراك المختار", async ({ page, viewport }) => {
    await page.goto("/");
    const bar = page.getByRole("complementary", { name: BAR });
    await expect(bar).toBeHidden();
    await page.locator("#plans").scrollIntoViewIfNeeded();
    if ((viewport?.width ?? 0) < 1024) {
      await expect(bar).toBeVisible();
      await expect(bar).toContainText(ANNUAL.price);
      await expect(bar.getByRole("link", { name: "اشترك عبر واتساب" })).toBeInViewport();
    } else {
      await expect(bar).toBeHidden();
    }
  });
});

test.describe("التركيز بلوحة المفاتيح", () => {
  test("شريط الشراء الثابت لا يحجب العنصر المركَّز عليه", async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 0) >= 1024, "الشريط الثابت خاص بالجوال");
    // التمرير الناعم غير متزامن؛ مع تقليل الحركة يصير فوريًا فيُقاس الموضع النهائي
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/memberships/${ANNUAL.slug}`);
    const steps = 40;
    for (let step = 0; step < steps; step++) {
      await page.keyboard.press("Tab");
      const hidden = await page.evaluate(() => {
        const focused = document.activeElement;
        const stickyBar = document.querySelector("[data-sticky-bar]:not([hidden])");
        // بعد آخر عنصر يخرج التركيز من الصفحة ويصير جسمها هو العنصر النشط: ليس عنصرًا محجوبًا
        if (
          focused === null ||
          focused === document.body ||
          stickyBar === null ||
          stickyBar.contains(focused)
        ) {
          return false;
        }
        return focused.getBoundingClientRect().bottom > stickyBar.getBoundingClientRect().top + 1;
      });
      expect(hidden, `العنصر رقم ${String(step + 1)} في ترتيب التنقل محجوب تحت الشريط`).toBe(false);
    }
  });
});
