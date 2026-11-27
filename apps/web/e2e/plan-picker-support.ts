import { expect, type Page } from "@playwright/test";
import { testDb } from "./payments-support";

/**
 * عدّة اختبارات محدِّد الاشتراك (القراران 78 و79): مبدّل مقطّع فوق بطاقة كبيرة واحدة. البيانات من بذرة المعاينة، والخادم
 * الأول (الشراء مغلق): زر البطاقة رابط واتساب يسمّي الاشتراك المختار.
 */
export const PLANS = [
  { slug: "three-months", nameAr: "3 أشهر + شهر مجانًا", price: "699" },
  { slug: "six-months", nameAr: "6 أشهر + شهران مجانًا", price: "999" },
  { slug: "one-year", nameAr: "12 شهرًا + شهران مجانًا", price: "1,499" },
] as const;
export const VISIBLE = { useInnerText: true };
export const WCAG_22_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** نادي بذرة المعاينة: الموقع العام يعرض باقاته، والاختبار يراها وحدها. */
const SITE_CLUB = "masar-al-abtal";

/**
 * قاعدة الاختبار المشتركة تحتفظ بباقات أندية الاختبار من تشغيلات سابقة (ct-*). هذا المشروع يعمل قبل
 * أي مشروع ينشر باقات (playwright.config.ts)، فيؤرشف تلك البقايا ليرى الموقع الباقات الثلاث وحدها.
 * يُستدعى في أول كل ملف من ملفي المحدِّد.
 */
export async function archiveLeftoverPlans(): Promise<void> {
  const db = testDb();
  try {
    await db.product.updateMany({
      where: { status: "active", club: { slug: { not: SITE_CLUB } } },
      data: { status: "archived" },
    });
  } finally {
    await db.$disconnect();
  }
}

export function card(page: Page) {
  return page.locator("#plans [data-plan-card]");
}

export function radio(page: Page, slug: string) {
  return page.locator(`#plans input[name="plan"][value="${slug}"]`);
}

/** رسالة واتساب في زر الشراء الظاهر (الوحيد في شجرة الوصول). */
export async function ctaMessage(page: Page): Promise<string> {
  const link = card(page).getByRole("link", { name: /اشترك عبر واتساب/ });
  await expect(link).toHaveCount(1);
  const href = (await link.getAttribute("href")) ?? "";
  expect(new URL(href).hostname).toBe("wa.me");
  return new URL(href).searchParams.get("text") ?? "";
}

/** انتهت حركات القسم (تلاشي النسخة السابقة ودوران السعر)، فلا يُفحص منتصف الانتقال. */
export async function settled(page: Page): Promise<void> {
  await page.waitForFunction(
    () => (document.querySelector("#plans")?.getAnimations({ subtree: true }).length ?? 0) === 0,
  );
}

/**
 * المبلغ كما يُرى: الخانات مرتبة بموضعها على الشاشة، ولكل خانة رقمها الظاهر من إزاحة شريطها
 * (0–9 مرتين، الرقم في الدورة الثانية)، لا من نص الصفحة.
 */
/** الشريط 20 صفًا (0–9 مرتين): كل صف 5% من ارتفاعه، والرقم الظاهر في الدورة الثانية. */
const STRIP = { percentPerRow: 5, cycle: 10 };

export function shownAmount(page: Page, slug: string): Promise<string> {
  return page
    .locator(`#plans [data-plan-card] [data-variant][data-plan="${slug}"] [aria-hidden] > span`)
    .evaluateAll(
      (cells, { percentPerRow, cycle }) =>
        cells
          .map((cell) => {
            const box = cell.getBoundingClientRect();
            const glyph = cell.getAttribute("data-glyph");
            if (glyph !== null) {
              return { x: box.x, text: glyph };
            }
            const shift = getComputedStyle(cell, "::before").translate.split(" ")[1] ?? "0px";
            const rows = shift.endsWith("%")
              ? -Number.parseFloat(shift) / percentPerRow
              : -Number.parseFloat(shift) / box.height;
            return { x: box.x, text: String(Math.round(rows) - cycle) };
          })
          .sort((a, b) => a.x - b.x)
          .map((cell) => cell.text)
          .join(""),
      STRIP,
    );
}

export async function expectSelected(page: Page, plan: (typeof PLANS)[number]) {
  await expect(radio(page, plan.slug)).toBeChecked();
  await expect(card(page)).toContainText(`${plan.price} ر.س`, VISIBLE);
  await expect(card(page)).toContainText(plan.nameAr, VISIBLE);
  expect(await ctaMessage(page)).toContain(plan.nameAr);
}
