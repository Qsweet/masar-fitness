import { expect, test, type Page } from "@playwright/test";

/** البيانات من البذرة التجريبية (packages/db/prisma/seed-demo.ts). */
const ANNUAL = { slug: "one-year", nameAr: "سنة كاملة", nameEn: "12 months", price: "2,800" };
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
    await expect(annual).toContainText("نحو 200 ر.س شهريًا");
    await expect(annual.getByRole("radio")).toBeChecked();

    await expect(summary(page)).toContainText(ANNUAL.nameAr);
    await expect(summary(page)).toContainText(`${ANNUAL.price} ر.س`);
    await expect(summary(page)).toContainText("شامل ضريبة القيمة المضافة");
    await expect(summary(page)).toContainText("14 شهرًا، منها شهران مجانًا");
    await expect(summary(page)).toContainText("نحو 200 ر.س شهريًا");
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
    await expect(summary(page)).toContainText("ثلاثة أشهر");
    await expect(summary(page)).toContainText("900 ر.س");
    await expect(summary(page)).toContainText("نحو 300 ر.س شهريًا");
    await summary(page)
      .getByRole("link", { name: /تفاصيل الاشتراك/ })
      .click();
    await expect(page).toHaveURL(/\/memberships\/three-months$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("ثلاثة أشهر");
  });

  test("الاختيار بلوحة المفاتيح: الأسهم تنقل بين المدد", async ({ page }) => {
    await page.goto("/");
    await durations(page).getByRole("radio", { checked: true }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(durations(page).getByRole("radio", { checked: true })).toBeFocused();
    await expect(durations(page).getByRole("radio", { checked: true })).not.toHaveValue(
      ANNUAL.slug,
    );
    await expect(summary(page)).toContainText("ستة أشهر");
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
  test("المقارنة: جدول على الشاشة الواسعة وصفوف مكدّسة بزر كامل العرض على الجوال", async ({
    page,
    viewport,
  }) => {
    await page.goto("/memberships");
    const compare = page.locator("#compare");
    const table = compare.getByRole("table");
    const rows = compare.locator("ul > li");
    if ((viewport?.width ?? 0) >= 768) {
      await expect(table.getByRole("columnheader")).toHaveCount(5);
      const priceRow = table.getByRole("row", { name: /السعر الإجمالي/ });
      await expect(priceRow).toContainText("350");
      await expect(priceRow).toContainText(ANNUAL.price);
      await expect(table.getByRole("row", { name: /إجمالي المدة/ })).toContainText("14 شهرًا");
      await expect(rows.first()).toBeHidden();
    } else {
      await expect(table).toBeHidden();
      await expect(rows).toHaveCount(4);
      const annual = rows.filter({ hasText: ANNUAL.nameAr });
      await expect(annual).toContainText("14 شهرًا، منها شهران مجانًا");
      await expect(annual).toContainText(ANNUAL.price);
      await expect(annual).toContainText("200");
      const choose = annual.getByRole("link", { name: new RegExp(`اختر\\s*: ${ANNUAL.nameAr}`) });
      const box = await choose.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      // الصفحة لا تتحرك أفقيًا
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    }
    // كل الاشتراكات بالمزايا نفسها: جملة واحدة بدل صفوف علامات متطابقة
    await expect(compare).toContainText(
      "كل الاشتراكات تشمل جميع المرافق: صالة الحديد والتمارين الوظيفية والمسبح والجاكوزي والبخار.",
    );
    await expect(compare.getByText("مشمول")).toHaveCount(0);
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
    await expect(summary(page)).toContainText("شهر واحد");
    await expect(summary(page)).not.toContainText("نحو");
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
    await expect(summary(page)).toContainText("14 months, including 2 months free");
  });

  test("الرابط المعتمد وبدائل اللغة", async ({ page, baseURL }) => {
    await page.goto(`/en/memberships/${ANNUAL.slug}`);
    const origin = baseURL ?? "";
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
    let checked = 0;
    for (let step = 0; step < steps; step++) {
      await page.keyboard.press("Tab");
      const state = await page.evaluate(() => {
        const focused = document.activeElement;
        const stickyBar = document.querySelector("[data-sticky-bar]:not([hidden])");
        // بعد آخر عنصر يخرج التركيز من الصفحة ويصير جسمها هو العنصر النشط: ليس عنصرًا محجوبًا
        if (
          focused === null ||
          focused === document.body ||
          stickyBar === null ||
          stickyBar.contains(focused)
        ) {
          return "skipped";
        }
        const covered =
          focused.getBoundingClientRect().bottom > stickyBar.getBoundingClientRect().top + 1;
        return covered ? "covered" : "clear";
      });
      expect(state, `العنصر رقم ${String(step + 1)} في ترتيب التنقل محجوب تحت الشريط`).not.toBe(
        "covered",
      );
      checked += state === "clear" ? 1 : 0;
    }
    // الاختبار لا ينجح فارغًا: عناصر فُحصت فعلًا والشريط ظاهر
    expect(checked).toBeGreaterThan(0);
  });
});

test.describe("قائمة الجوال", () => {
  test("تُغلق بعد اختيار رابط وعند Escape", async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 0) >= 1024, "القائمة خاصة بالجوال");
    await page.goto("/");
    const menu = page.getByRole("banner").locator("details");
    await menu.locator("summary").click();
    await expect(menu).toHaveAttribute("open", "");
    await page
      .getByRole("navigation", { name: "قائمة الجوال" })
      .getByRole("link", { name: "التمرين" })
      .click();
    await expect(page).toHaveURL(/#train$/);
    await expect(menu).not.toHaveAttribute("open");

    await menu.locator("summary").click();
    await page.keyboard.press("Escape");
    await expect(menu).not.toHaveAttribute("open");
    await expect(menu.locator("summary")).toBeFocused();
  });
});
