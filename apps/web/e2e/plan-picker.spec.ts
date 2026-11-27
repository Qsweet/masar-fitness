import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * محدِّد الاشتراك (القرار 78): مبدّل مقطّع فوق بطاقة كبيرة واحدة. البيانات من بذرة المعاينة، والخادم
 * الأول (الشراء مغلق): زر البطاقة رابط واتساب يسمّي الاشتراك المختار.
 */
const PLANS = [
  { slug: "three-months", nameAr: "3 أشهر + شهر مجانًا", price: "699" },
  { slug: "six-months", nameAr: "6 أشهر + شهران مجانًا", price: "999" },
  { slug: "one-year", nameAr: "12 شهرًا + شهران مجانًا", price: "1,499" },
] as const;
const VISIBLE = { useInnerText: true };
const WCAG_22_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

function card(page: Page) {
  return page.locator("#plans [data-plan-card]");
}

function radio(page: Page, slug: string) {
  return page.locator(`#plans input[name="plan"][value="${slug}"]`);
}

/** رسالة واتساب في زر الشراء الظاهر (الوحيد في شجرة الوصول). */
async function ctaMessage(page: Page): Promise<string> {
  const link = card(page).getByRole("link", { name: /اشترك عبر واتساب/ });
  await expect(link).toHaveCount(1);
  const href = (await link.getAttribute("href")) ?? "";
  expect(new URL(href).hostname).toBe("wa.me");
  return new URL(href).searchParams.get("text") ?? "";
}

/** انتهت حركات القسم (تلاشي النسخة السابقة ودوران السعر)، فلا يُفحص منتصف الانتقال. */
async function settled(page: Page): Promise<void> {
  await page.waitForFunction(
    () => (document.querySelector("#plans")?.getAnimations({ subtree: true }).length ?? 0) === 0,
  );
}

async function expectSelected(page: Page, plan: (typeof PLANS)[number]) {
  await expect(radio(page, plan.slug)).toBeChecked();
  await expect(card(page)).toContainText(`${plan.price} ر.س`, VISIBLE);
  await expect(card(page)).toContainText(plan.nameAr, VISIBLE);
  expect(await ctaMessage(page)).toContain(plan.nameAr);
}

test.describe("محدِّد الاشتراك", () => {
  test("تبديل المدة يحدّث السعر وزر الشراء، والمعلَن لقارئ الشاشة", async ({ page }) => {
    await page.goto("/");
    await expectSelected(page, PLANS[2]);
    for (const plan of PLANS) {
      await radio(page, plan.slug).check();
      await expectSelected(page, plan);
    }
    await radio(page, "six-months").check();
    await expect(page.locator("#plans [aria-live]")).toHaveText(
      "مسار التغيير: 999 ر.س، 8 أشهر، منها شهران مجانًا",
    );
  });

  test("السعر يدور مع الحركة، ويثبت فورًا بلا حركة مع تقليلها", async ({ page }) => {
    // حركات القسم وحده (الدوران على ::before داخل الشجرة، والانتقالات)
    const running = () =>
      page.evaluate(
        () => document.querySelector("#plans")?.getAnimations({ subtree: true }).length ?? 0,
      );
    await page.goto("/");
    await radio(page, PLANS[0].slug).check();
    expect(await running()).toBeGreaterThan(0);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await radio(page, PLANS[0].slug).check();
    await expect(card(page)).toContainText(`${PLANS[0].price} ر.س`, VISIBLE);
    expect(await running()).toBe(0);
    // لا انتقال في المؤشر ولا في تبدّل البطاقة
    const visible = card(page).locator(`[data-plan="${PLANS[0].slug}"]`).first();
    const duration = await visible.evaluate((node) => getComputedStyle(node).transitionDuration);
    expect(Number.parseFloat(duration)).toBeLessThan(0.001);
    await expect(visible).toHaveCSS("opacity", "1");
  });

  test("لوحة المفاتيح: نقطة توقف واحدة، والأسهم بالاتجاه المرئي في العربية والإنجليزية", async ({
    page,
  }) => {
    await page.goto("/");
    await radio(page, "one-year").focus();
    // العربية من اليمين: 3 أشهر أقصى اليمين و12 شهرًا أقصى اليسار؛ اليسار يتقدم ويلتف إلى الأول
    await page.keyboard.press("ArrowLeft");
    await expect(radio(page, "three-months")).toBeFocused();
    await expectSelected(page, PLANS[0]);
    await page.keyboard.press("ArrowLeft");
    await expectSelected(page, PLANS[1]);
    await page.keyboard.press("ArrowRight");
    await expectSelected(page, PLANS[0]);
    // Tab يغادر المجموعة إلى زر الشراء في البطاقة
    await page.keyboard.press("Tab");
    await expect(card(page).getByRole("link", { name: /اشترك عبر واتساب/ })).toBeFocused();

    await page.goto("/en");
    await radio(page, "one-year").focus();
    await page.keyboard.press("ArrowLeft");
    await expect(radio(page, "six-months")).toBeChecked();
    await page.keyboard.press("ArrowRight");
    await expect(radio(page, "one-year")).toBeChecked();
  });

  test("axe نظيف لكل مدة باللغتين", async ({ page }) => {
    for (const prefix of ["", "/en"]) {
      await page.goto(`${prefix}/memberships`.replace(/^\/\//, "/"));
      for (const plan of PLANS) {
        await radio(page, plan.slug).check();
        await settled(page);
        const results = await new AxeBuilder({ page })
          .include("#plans")
          .withTags(WCAG_22_AA)
          .analyze();
        const summary = results.violations.map(
          (violation) =>
            `${violation.id}: ${violation.nodes.map((node) => `${node.target.join(" ")} ${node.failureSummary ?? ""}`).join(" | ")}`,
        );
        expect(summary, `${prefix} ${plan.slug}`).toEqual([]);
      }
    }
  });
});

test.describe("محدِّد الاشتراك بلا JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("الراديو الأصلي يبدّل البطاقة وزر الشراء بـCSS وحده", async ({ page }) => {
    await page.goto("/memberships");
    await expectSelected(page, PLANS[2]);
    for (const plan of PLANS) {
      await radio(page, plan.slug).check();
      await expectSelected(page, plan);
    }
    // الأسهم من المتصفح نفسه
    await radio(page, "three-months").focus();
    await page.keyboard.press("ArrowLeft");
    await expectSelected(page, PLANS[1]);
    // شريط الجوال يحتاج JavaScript فيبقى مخفيًا
    await expect(page.getByRole("complementary", { name: "ملخص الاشتراك" })).toBeHidden();
  });
});
