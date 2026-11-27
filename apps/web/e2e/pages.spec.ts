import { expect, test, type Page } from "@playwright/test";

/** البيانات من بذرة المعاينة (packages/db/prisma/seed-demo.ts): أسعار النادي الحالية مؤقتًا. */
const ANNUAL = {
  slug: "one-year",
  nameAr: "12 شهرًا + شهران مجانًا",
  nameEn: "12 months + 2 free",
  price: "1,499",
};
const QUARTER = { slug: "three-months", nameAr: "3 أشهر + شهر مجانًا", price: "699" };

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
const BAR = "ملخص الاشتراك";

function durations(page: Page) {
  return page.getByRole("group", { name: "مدة الاشتراك" });
}

/** البطاقة الكبيرة: نسخة كل اشتراك فيها، والظاهرة المختار وحده (النص المرئي فقط). */
function card(page: Page) {
  return page.locator("#plans [data-plan-card]");
}
const VISIBLE = { useInnerText: true };

/** رأس صفحة الاشتراك الواحد: العنوان وبطاقة السعر وزر الشراء. */
function offer(page: Page) {
  return page.locator("#top");
}

test.describe("الرئيسية", () => {
  test("مبدّل المدد الثلاث من القاعدة، والأوفر شهريًا مختار ببطاقته", async ({ page }) => {
    await page.goto("/");
    const options = durations(page).getByRole("radio");
    await expect(options).toHaveCount(3);
    // ترتيب واحد بالمدة في كل المقاسات وفي جدول المقارنة: 3 ← 6 ← 12، والأوفر بشارته
    await expect(options.nth(2)).toHaveValue(ANNUAL.slug);
    await expect(options.nth(2)).toBeChecked();
    await expect(durations(page).getByRole("radio", { name: /12 شهرًا/ })).toBeChecked();
    // شارة «الأوفر شهريًا» محسوبة: على مقطع واحد فقط
    await expect(durations(page).getByText("الأكثر قيمة", { exact: true })).toHaveCount(1);
    await expect(durations(page).locator("label").nth(2)).toContainText("الأكثر قيمة");

    await expect(card(page)).toContainText(ANNUAL.nameAr, VISIBLE);
    await expect(card(page)).toContainText(`${ANNUAL.price} ر.س`, VISIBLE);
    await expect(card(page)).toContainText("نحو 107 ر.س شهريًا", VISIBLE);
    // اليومي بالصيغة نفسها: «نحو … يوميًا» لا علامة «≈» منفصلة في طرف السطر
    await expect(card(page)).toContainText(/نحو [\d.]+ ر\.س يوميًا/, VISIBLE);
    await expect(card(page)).toContainText("تجميد حتى 60 يومًا", VISIBLE);
    await expect(card(page)).not.toContainText(QUARTER.nameAr, VISIBLE);
    // شريط الأشهر ببديله النصي، والمقارنة بالأقصر مدة بأرقام الخادم
    await expect(
      card(page).getByRole("img", { name: "14 شهرًا، منها شهران مجانًا" }),
    ).toBeVisible();
    await expect(card(page)).toContainText(
      "تدفع شهريًا نحو 107 ر.س بدل 175 ر.س في انطلاقة الأبطال",
      VISIBLE,
    );
    // سطر الضريبة مرة واحدة تحت عنوان القسم، لا تحت كل سعر (الضريبة غير مؤكدة في صفحات المنتجات)
    await expect(page.locator("#plans").getByText(/الضريبة/)).toHaveCount(1);
    await expect(page.locator("#plans .lead").first()).toContainText(
      "الأسعار شاملة الضريبة حسب شروط النادي",
    );
  });

  test("اختيار مدة يبدّل البطاقة فورًا بلا انتقال", async ({ page }) => {
    await page.goto("/");
    await durations(page).locator(`input[value="${QUARTER.slug}"]`).check();
    await expect(page).toHaveURL(/\/$/);
    await expect(card(page)).toContainText(QUARTER.nameAr, VISIBLE);
    await expect(card(page)).toContainText(`${QUARTER.price} ر.س`, VISIBLE);
    await expect(card(page)).not.toContainText(ANNUAL.nameAr, VISIBLE);
    await expect(card(page).getByRole("img", { name: "4 أشهر، منها شهر مجانًا" })).toBeVisible();
    // الأقصر مدة هو المرجع: لا سطر مقارنة له
    await expect(card(page)).not.toContainText("تدفع شهريًا", VISIBLE);
    await card(page)
      .getByRole("link", { name: /تفاصيل الاشتراك/ })
      .click();
    await expect(page).toHaveURL(/\/memberships\/three-months$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("انطلاقة الأبطال");
  });

  test("روابط الموقع الحقيقية: الخريطة والهاتف", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "افتح الخريطة" })).toHaveAttribute(
      "href",
      /google\.com\/maps\/dir\/\?api=1&destination=26\.4077931/,
    );
    await expect(
      page.getByRole("main").getByRole("link", { name: "016 324 0111", exact: true }),
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
      await expect(table.getByRole("columnheader")).toHaveCount(4);
      const priceRow = table.getByRole("row", { name: /السعر الإجمالي/ });
      await expect(priceRow).toContainText(QUARTER.price);
      await expect(priceRow).toContainText(ANNUAL.price);
      await expect(table.getByRole("row", { name: /إجمالي المدة/ })).toContainText("14 شهرًا");
      await expect(rows.first()).toBeHidden();
    } else {
      await expect(table).toBeHidden();
      await expect(rows).toHaveCount(3);
      const annual = rows.filter({ hasText: ANNUAL.nameAr });
      await expect(annual).toContainText("14 شهرًا، منها شهران مجانًا");
      await expect(annual).toContainText(ANNUAL.price);
      await expect(annual).toContainText("107");
      const choose = annual.getByRole("link", {
        name: new RegExp(`اختر\\s*: ${escapeRegExp(ANNUAL.nameAr)}`),
      });
      const box = await choose.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      // الصفحة لا تتحرك أفقيًا
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    }
    // كل الاشتراكات بالمزايا نفسها: جملة واحدة بدل صفوف علامات متطابقة
    await expect(compare).toContainText(
      "كل الاشتراكات تشمل جميع المرافق: صالة الحديد والتمارين الوظيفية والحصص الجماعية والمسبح والجاكوزي والساونا والبخار.",
    );
    await expect(compare.getByText("مشمول")).toHaveCount(0);
  });
});

test.describe("صفحة الاشتراك", () => {
  test("عرض مركّز بلا محدِّد مكرر: السعر للشخص والمدة، وما يشمله، وشروط التفعيل والتجميد", async ({
    page,
  }) => {
    await page.goto(`/memberships/${ANNUAL.slug}`);
    await expect(durations(page)).toHaveCount(0);
    // العنوان اسم الباقة التسويقي، والمدة سطر تحته و«+» ملتصق بما بعده (لا «+» وحده في آخر السطر)
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("رحلة الأبطال");
    await expect(page.locator("#top")).toContainText("12 شهرًا +\u00a0شهران مجانًا");
    const hero = offer(page);
    await expect(hero).toContainText("الإجمالي للشخص");
    await expect(hero).toContainText(`${ANNUAL.price} ر.س`);
    await expect(hero).toContainText("14 شهرًا، منها شهران مجانًا");
    await expect(hero).toContainText("نحو 107 ر.س شهريًا");
    await expect(hero).toContainText("الأكثر قيمة");
    await expect(page.getByRole("heading", { name: "يشمل الاشتراك" })).toBeVisible();
    const terms = page.locator("section", {
      has: page.getByRole("heading", { name: "شروط الاشتراك" }),
    });
    await expect(terms).toContainText("تجميد حتى 60 يومًا");
    await expect(terms).toContainText("5 أيام لكل شهر مدفوع");
    await expect(terms).toContainText("يبدأ الاشتراك من تاريخ التفعيل في النادي.");
    await expect(terms).toContainText("لا يجوز استخدام الاشتراك من شخص آخر");
    // رأس واحد: لا سطر «الاشتراكات» تحت رابط «كل الاشتراكات»
    await expect(page.locator("#top .eyebrow")).toHaveCount(0);
  });

  test("اشتراك غير الأوفر بلا وسم الأوفر، وتجميده بمدته", async ({ page }) => {
    await page.goto("/memberships/three-months");
    await expect(offer(page)).toContainText(`${QUARTER.price} ر.س`);
    await expect(offer(page)).not.toContainText("الأكثر قيمة");
    await expect(page.getByText("تجميد حتى 15 يومًا")).toBeVisible();
  });

  test("اشتراك مؤرشف (شهر واحد التجريبي القديم) لا صفحة له", async ({ page }) => {
    const response = await page.goto("/memberships/one-month");
    expect(response?.status()).toBe(404);
  });

  test("زر الشراء يفتح واتساب النادي برسالة تسمّي الاشتراك", async ({ page }) => {
    await page.goto(`/memberships/${ANNUAL.slug}`);
    const href = await offer(page)
      .getByRole("link", { name: "اشترك عبر واتساب" })
      .getAttribute("href");
    const url = new URL(href ?? "");
    expect(`${url.origin}${url.pathname}`).toBe("https://wa.me/966553240111");
    expect(url.searchParams.get("text")).toBe(`مرحبًا، أرغب في اشتراك «${ANNUAL.nameAr}».`);
  });

  test("النسخة الإنجليزية بالاسم والعملة الإنجليزيين", async ({ page }) => {
    await page.goto(`/en/memberships/${ANNUAL.slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Champions' Journey");
    await expect(page.locator("#top")).toContainText(ANNUAL.nameEn.replace("+ ", "+\u00a0"));
    await expect(offer(page)).toContainText(`${ANNUAL.price} SAR`);
    await expect(offer(page)).toContainText("14 months, including 2 months free");
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

/** المبدّل قرب أعلى الشاشة وزر شراء البطاقة تحتها: الحال التي يظهر فيها شريط الجوال. */
async function scrollToSwitch(page: Page): Promise<void> {
  await page.evaluate(() => {
    const top = document.getElementById("plan-picker")?.getBoundingClientRect().top ?? 0;
    window.scrollBy(0, top - 160);
  });
}

test.describe("شريط الشراء الثابت", () => {
  test("على الجوال: يظهر بالإجمالي ما دام المحدِّد ظاهرًا وزر بطاقته لا", async ({
    page,
    viewport,
  }) => {
    // تبدّل البطاقة فوري مع تقليل الحركة: زر واحد ظاهر بلا انتظار التلاشي
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const bar = page.getByRole("complementary", { name: BAR });
    await expect(bar).toBeHidden();
    await scrollToSwitch(page);
    if ((viewport?.width ?? 0) >= 1024) {
      await expect(bar).toBeHidden();
      return;
    }
    await expect(bar).toBeVisible();
    await expect(bar).toContainText(`${ANNUAL.price} ر.س`);
    await expect(bar.getByRole("link", { name: "اشترك عبر واتساب" })).toBeInViewport();
    // تغيير المدة يحدّث الشريط معها
    await durations(page).locator(`input[value="${QUARTER.slug}"]`).check();
    await expect(bar).toContainText(`${QUARTER.price} ر.س`);
    // زر البطاقة ظاهر: الشريط يختفي فلا يتكرر
    await card(page).getByRole("link", { name: "اشترك عبر واتساب" }).scrollIntoViewIfNeeded();
    await expect(bar).toBeHidden();
    // خارج القسم لا شريط
    await page.locator("#services").scrollIntoViewIfNeeded();
    await expect(bar).toBeHidden();
  });

  test("يختفي أثناء الكتابة في حقل ويعود بعدها", async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 0) >= 1024, "الشريط الثابت خاص بالجوال");
    await page.goto("/");
    const bar = page.getByRole("complementary", { name: BAR });
    await scrollToSwitch(page);
    await expect(bar).toBeVisible();
    // تركيز بلا تمرير: المحدِّد يبقى على الشاشة، فالاختفاء من الكتابة وحدها
    const name = page.getByRole("textbox", { name: "الاسم" });
    await name.evaluate((field: HTMLElement) => {
      field.focus({ preventScroll: true });
    });
    await expect(bar).toBeHidden();
    await name.evaluate((field: HTMLElement) => {
      field.blur();
    });
    await expect(bar).toBeVisible();
  });
});

test.describe("التركيز بلوحة المفاتيح", () => {
  test("شريط الشراء وشريط التبويب الثابتان لا يحجبان العنصر المركَّز عليه", async ({
    page,
    viewport,
  }) => {
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
        // الشريطان الثابتان أسفل الهاتف: شريط فعل الصفحة وشريط التبويب
        const bars = [
          document.querySelector("[data-sticky-bar]:not([hidden])"),
          document.querySelector('nav[aria-label="التنقل السريع"]'),
        ].filter((bar): bar is Element => bar !== null && bar.getBoundingClientRect().height > 0);
        // بعد آخر عنصر يخرج التركيز من الصفحة ويصير جسمها هو العنصر النشط: ليس عنصرًا محجوبًا
        if (
          focused === null ||
          focused === document.body ||
          bars.length === 0 ||
          bars.some((bar) => bar.contains(focused))
        ) {
          return "skipped";
        }
        const top = Math.min(...bars.map((bar) => bar.getBoundingClientRect().top));
        return focused.getBoundingClientRect().bottom > top + 1 ? "covered" : "clear";
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
      .getByRole("link", { name: "المرافق" })
      .click();
    await expect(page).toHaveURL(/#facilities$/);
    await expect(menu).not.toHaveAttribute("open");

    await menu.locator("summary").click();
    await page.keyboard.press("Escape");
    await expect(menu).not.toHaveAttribute("open");
    await expect(menu.locator("summary")).toBeFocused();
  });
});
