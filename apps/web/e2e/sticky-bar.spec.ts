import { expect, test, type Page } from "@playwright/test";

/** شريطا الهاتف الثابتان (شراء الاشتراك وفعل صفحة الاشتراك) والتركيز تحتهما. البيانات من بذرة المعاينة. */
const ANNUAL = { slug: "one-year", price: "1,499" };
const QUARTER = { slug: "three-months", price: "699" };
const BAR = "ملخص الاشتراك";

function durations(page: Page) {
  return page.getByRole("group", { name: "مدة الاشتراك" });
}

function card(page: Page) {
  return page.locator("#plans [data-plan-card]");
}

/** المبدّل قرب أعلى الشاشة وزر شراء البطاقة تحتها: الحال التي يظهر فيها شريط الجوال. */
async function scrollToSwitch(page: Page): Promise<void> {
  await page.evaluate(() => {
    const top = document.getElementById("plan-picker")?.getBoundingClientRect().top ?? 0;
    window.scrollBy(0, top - 160);
  });
}

test.describe("شريط الشراء الثابت", () => {
  test("على الجوال: يظهر بالإجمالي من وصول المحدِّد، ويختفي ما دام زر بطاقته ظاهرًا", async ({
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
    // بعد القسم يبقى، وقبله (الواجهة) لا شريط
    await page.locator("#services").scrollIntoViewIfNeeded();
    await expect(bar).toBeVisible();
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
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
