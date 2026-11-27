import AxeBuilder from "@axe-core/playwright";
import type { Db } from "@masar/db";
import { expect, test, type Page } from "@playwright/test";
import {
  createSlide,
  fillSlide,
  MEDIA,
  PHOTO,
  PHOTO_2,
  PHOTO_3,
  SLIDER,
  SLIDER_SHOTS_DIR,
  uploadPhoto,
} from "./admin-slider-support";
import { newClub, newStaff, setTheme, signIn } from "./admin-support";
import { watchProblems } from "./admin-shots-support";
import { testDb } from "./payments-support";

/**
 * صفحات الشريط والمكتبة (ADMIN_A3_SLIDER §11): axe في المظهرين، ولقطات 390 و1440 بالمظهرين للمراجعة
 * البصرية، بلا تمرير أفقي ولا خطأ في console. في مشروع واحد: الاختبار يغيّر المقاس بنفسه.
 */
const WCAG_22_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const THEMES = ["dark", "light"] as const;
const WIDTHS = [390, 1440] as const;
const HEIGHT = 900;
const SHOT_PROJECT_WIDTH = 1440;
let db: Db;

test.beforeAll(() => {
  db = testDb();
});

test.afterAll(async () => {
  await db.$disconnect();
});

test.beforeEach(({ page }) => {
  test.skip(page.viewportSize()?.width !== SHOT_PROJECT_WIDTH, "مشروع واحد يغيّر المقاس بنفسه");
});

async function check(page: Page, name: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();
  const summary = results.violations.map(
    (violation) =>
      `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(" | ")}`,
  );
  expect(summary, name).toEqual([]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `تمرير أفقي: ${name}`).toBeLessThanOrEqual(0);
}

async function shootPage(page: Page, path: string, name: string, prepare?: () => Promise<void>) {
  for (const theme of THEMES) {
    await setTheme(page, theme);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: HEIGHT });
      await page.goto(path);
      await prepare?.();
      await check(page, `${name} ${theme} ${String(width)}`);
      await page.screenshot({
        path: `${SLIDER_SHOTS_DIR}/admin-${name}-${theme}-${String(width)}.png`,
        fullPage: true,
      });
    }
  }
}

test("صفحات الشريط والمكتبة بلا مخالفات وصول، ولقطاتها بالمظهرين والمقاسين", async ({ page }) => {
  test.slow();
  const problems = watchProblems(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const club = await newClub(db);
  await signIn(page, await newStaff(db, club, { role: "owner", withTotp: true }));
  const asset = await uploadPhoto(page, PHOTO);
  await uploadPhoto(page, PHOTO_2);
  await uploadPhoto(page, PHOTO_3);
  await createSlide(page, {
    photo: "trainer-portrait.jpg",
    title: { ar: "تدرّب بإشراف مدربين معتمدين", en: "Train with certified coaches" },
    subtitle: {
      ar: "برامج للقوة واللياقة لكل المستويات.",
      en: "Strength and fitness for every level.",
    },
    cta: { ar: "اكتشف الاشتراكات", en: "See memberships" },
    internal: "/memberships",
  });
  await createSlide(page, {
    photo: "lat-pulldown.jpg",
    title: { ar: "جولة في صالة الحديد", en: "Tour the weights hall" },
    external: "https://example.com/tour",
    wholeSlide: true,
  });
  await page.goto("/admin/content/slider");
  await page
    .getByTestId("slide-list")
    .getByRole("link", { name: "جولة في صالة الحديد", exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/content\/slider\/[0-9a-f-]{36}$/);
  const editor = new URL(page.url()).pathname;
  await page.getByLabel(SLIDER.form.active).uncheck();
  await page.getByRole("button", { name: SLIDER.form.save }).click();
  await expect(page).toHaveURL(/\/admin\/content\/slider\?done=/);

  await shootPage(page, "/admin/content/slider", "slider-list");
  await shootPage(page, editor, "slide-editor");
  await shootPage(page, "/admin/content/slider/new", "slide-new-errors", async () => {
    await fillSlide(page, {
      photo: "coach-floor.jpg",
      title: { ar: "عنوان", en: "Title" },
      external: "http://example.com",
    });
    await page.getByRole("button", { name: SLIDER.form.create }).click();
    await expect(page.getByText(/https:\/\/ فقط/).first()).toBeVisible();
  });
  await shootPage(page, "/admin/content/media", "media-library", async () => {
    await expect(page.getByTestId("media-grid").getByRole("listitem")).toHaveCount(3);
  });
  await shootPage(page, `/admin/content/media/${asset}`, "media-asset", async () => {
    await expect(page.getByText(MEDIA.asset.deleteBlocked)).toBeVisible();
  });
  await shootPage(page, "/admin/content/publish", "publish-diff", async () => {
    await expect(page.getByTestId("slider-diff")).toBeVisible();
  });
  expect(problems).toEqual([]);
});
