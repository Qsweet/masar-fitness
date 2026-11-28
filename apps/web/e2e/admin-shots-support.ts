import { expect, type Page } from "@playwright/test";
import { setTheme } from "./admin-support";

/**
 * عدّة لقطات اللوحة للمراجعة البصرية: أربعة مقاسات ومظهران، مع فحص أن لا تمرير أفقي ولا خطأ console
 * (ومنه مخالفات CSP). تُحفظ في apps/web/screens/admin (خارج git).
 */
export const SHOTS_DIR = "screens/admin";
const PHONE = 390;
const TABLET = 768;
export const SHOT_DESKTOP = 1440;
const WIDE = 1920;
export const SHOT_WIDTHS = [PHONE, TABLET, SHOT_DESKTOP, WIDE] as const;
export const SHOT_THEMES = ["dark", "light"] as const;
export const SHOT_HEIGHT = 900;

export function watchProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      problems.push(message.text());
    }
  });
  page.on("pageerror", (error) => problems.push(error.message));
  return problems;
}

/**
 * تغيير المقاس ينقل الشريط الجانبي بين الدرج والعمود الثابت بحركة؛ اللقطة قبل نهايتها تلتقطه غائبًا.
 * تُنتظر الحركات المنتهية وحدها (المتكررة بلا نهاية لا تنتهي).
 */
export async function settleAnimations(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );
}

export async function shot(page: Page, name: string): Promise<void> {
  const width = page.viewportSize()?.width ?? 0;
  await settleAnimations(page);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `تمرير أفقي في ${name} عند ${String(width)}`).toBeLessThanOrEqual(0);
  await page.screenshot({ path: `${SHOTS_DIR}/${name}-${String(width)}.png`, fullPage: true });
}

/** الصفحة الحالية بالمظهرين والمقاسات الأربعة. `prepare` يعيد الحالة بعد تبديل المظهر. */
export async function shootAll(
  page: Page,
  name: string,
  prepare?: () => Promise<void>,
): Promise<void> {
  for (const theme of SHOT_THEMES) {
    await setTheme(page, theme);
    await page.reload();
    await prepare?.();
    for (const width of SHOT_WIDTHS) {
      await page.setViewportSize({ width, height: SHOT_HEIGHT });
      await shot(page, `${name}-${theme}`);
    }
  }
  await setTheme(page, "dark");
  await page.setViewportSize({ width: SHOT_DESKTOP, height: SHOT_HEIGHT });
  await page.reload();
  await prepare?.();
}

/**
 * حالة لا تصمد لإعادة التحميل (خطوة تأكيد، رقم مكشوف): تُلتقط كما هي بالمقاسات الأربعة في المظهر
 * الحالي، والمستدعي يعيد بناءها للمظهر الآخر.
 */
export async function shootHere(page: Page, name: string, theme: string): Promise<void> {
  // رد النموذج ينقل التركيز فيتمرر المتصفح إليه؛ اللقطة الكاملة تبدأ من أعلى الصفحة
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
  for (const width of SHOT_WIDTHS) {
    await page.setViewportSize({ width, height: SHOT_HEIGHT });
    await shot(page, `${name}-${theme}`);
  }
  await page.setViewportSize({ width: SHOT_DESKTOP, height: SHOT_HEIGHT });
}
