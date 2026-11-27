import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  archiveLeftoverPlans,
  card,
  expectSelected,
  PLANS,
  radio,
  settled,
  shownAmount,
  VISIBLE,
  WCAG_22_AA,
} from "./plan-picker-support";

/** محدِّد الاشتراك (القراران 78 و79): التبديل، والحركة، ولوحة المفاتيح، والوصول. */
test.beforeAll(archiveLeftoverPlans);

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
    // أطول حركة في القسم بالمللي ثانية (الدوران على ::before داخل الشجرة، والانتقالات)
    const longest = () =>
      page.evaluate(() =>
        Math.max(
          0,
          ...(document.querySelector("#plans")?.getAnimations({ subtree: true }) ?? []).map(
            (animation) => Number(animation.effect?.getTiming().duration ?? 0),
          ),
        ),
      );
    await page.goto("/");
    await radio(page, PLANS[0].slug).check();
    expect(await longest()).toBeGreaterThan(100);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await radio(page, PLANS[0].slug).check();
    await expect(card(page)).toContainText(`${PLANS[0].price} ر.س`, VISIBLE);
    // لا دوران؛ وما بقي انتقالات القاعدة العامة شبه الصفرية (0.01ms)
    expect(await longest()).toBeLessThan(1);
    // لا انتقال في المؤشر ولا في تبدّل البطاقة
    const visible = card(page).locator(`[data-plan="${PLANS[0].slug}"]`).first();
    const duration = await visible.evaluate((node) => getComputedStyle(node).transitionDuration);
    expect(Number.parseFloat(duration)).toBeLessThan(0.001);
    await expect(visible).toHaveCSS("opacity", "1");
  });

  test("لوحة المفاتيح: نقطة توقف واحدة، والأسهم بالاتجاه المرئي في العربية والإنجليزية", async ({
    page,
  }) => {
    // تبدّل فوري: زر شراء واحد ظاهر حين ينتقل التركيز إليه
    await page.emulateMedia({ reducedMotion: "reduce" });
    // الجيران من ترتيب الصفحة نفسها: قاعدة الاختبار المشتركة قد تعرض باقات أندية الاختبار بينها
    const neighbour = async (slug: string, step: 1 | -1): Promise<string> => {
      const values = await page
        .locator('#plans input[name="plan"]')
        .evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));
      const index = values.indexOf(slug);
      return values[(index + step + values.length) % values.length] ?? "";
    };
    await page.goto("/");
    await expect(page.locator("#plan-picker[data-hydrated]")).toHaveCount(1);
    await radio(page, "one-year").focus();
    // العربية من اليمين: الترتيب يمضي يسارًا، فالسهم الأيسر يتقدم (ويلتف من الأخير إلى الأول)
    const next = await neighbour("one-year", 1);
    await page.keyboard.press("ArrowLeft");
    await expect(radio(page, next)).toBeFocused();
    await expect(radio(page, next)).toBeChecked();
    await page.keyboard.press("ArrowRight");
    await expect(radio(page, "one-year")).toBeChecked();
    // Tab يغادر المجموعة إلى زر الشراء في البطاقة
    // البطاقة تبدّلت (النسخة السابقة خارج ترتيب التنقل) قبل مغادرة المجموعة
    await expect(page.locator(`#plan-actions > [data-plan="${next}"]`)).toBeHidden();
    await page.keyboard.press("Tab");
    await expect(card(page).getByRole("link", { name: /اشترك عبر واتساب/ })).toBeFocused();

    await page.goto("/en");
    await expect(page.locator("#plan-picker[data-hydrated]")).toHaveCount(1);
    await radio(page, "one-year").focus();
    const previous = await neighbour("one-year", -1);
    await page.keyboard.press("ArrowLeft");
    await expect(radio(page, previous)).toBeChecked();
    await page.keyboard.press("ArrowRight");
    await expect(radio(page, "one-year")).toBeChecked();
  });

  test("اسم المقطع المنطوق يشمل الأشهر المجانية", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("radio", { name: /^3 أشهر \+ شهر مجانًا/ })).toHaveValue(
      "three-months",
    );
    await expect(page.getByRole("radio", { name: /^12 شهرًا \+ شهران مجانًا/ })).toHaveValue(
      "one-year",
    );
  });

  test("النقر بعد التبديل مباشرة يصيب زر الاشتراك المختار لا السابق المتلاشي", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#plan-picker[data-hydrated]")).toHaveCount(1);
    // اختيار ثم قياس في الإطار التالي، والنسخة السابقة ما زالت تتلاشى (260ms) فوق الخلية نفسها
    const hit = await page.evaluate(async () => {
      document.querySelector<HTMLInputElement>('#plans input[value="three-months"]')?.click();
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const target = document.querySelector<HTMLElement>(
        '#plan-actions > [data-plan="three-months"] :is(a, button)',
      );
      target?.scrollIntoView({ block: "center", behavior: "instant" });
      const box = target?.getBoundingClientRect();
      if (box === undefined) {
        return "none";
      }
      const fading = document.querySelector<HTMLElement>('#plan-actions > [data-plan="one-year"]');
      const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      const plan = top?.closest<HTMLElement>("[data-variant]")?.dataset.plan ?? "none";
      return fading === null || getComputedStyle(fading).visibility === "visible" ? plan : "late";
    });
    expect(hit).toBe("three-months");
  });

  test("المعلَن لقارئ الشاشة الاختيار المستقر وحده، لا كل مدة مرّ بها", async ({ page }) => {
    await page.goto("/");
    await page.locator("#plans [aria-live]").evaluate((region) => {
      const heard: string[] = [];
      Reflect.set(window, "__heard", heard);
      new MutationObserver(() => {
        if (region.textContent !== "") {
          heard.push(region.textContent);
        }
      }).observe(region, { childList: true, characterData: true, subtree: true });
    });
    await radio(page, "three-months").check();
    await radio(page, "six-months").check();
    await expect(page.locator("#plans [aria-live]")).toHaveText(
      "مسار التغيير: 999 ر.س، 8 أشهر، منها شهران مجانًا",
    );
    expect(await page.evaluate(() => Reflect.get(window, "__heard") as unknown)).toEqual([
      "مسار التغيير: 999 ر.س، 8 أشهر، منها شهران مجانًا",
    ]);
  });

  test("الأرقام الظاهرة للسعر الدوّار بترتيبها على الشاشة، قبل الدوران وبعده", async ({ page }) => {
    await page.goto("/");
    expect(await shownAmount(page, "one-year")).toBe("1,499");
    await radio(page, "three-months").check();
    await settled(page);
    expect(await shownAmount(page, "three-months")).toBe("699");
    await radio(page, "one-year").check();
    await settled(page);
    expect(await shownAmount(page, "one-year")).toBe("1,499");
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
