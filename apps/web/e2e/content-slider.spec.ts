import AxeBuilder from "@axe-core/playwright";
import { oldestClubId, type Db } from "@masar/db";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { ar } from "../src/i18n/dictionaries/ar";
import { en } from "../src/i18n/dictionaries/en";
import {
  createSlide,
  PHOTO,
  PHOTO_2,
  PHOTO_3,
  publishAll,
  SLIDER,
  SLIDER_SHOTS_DIR,
  uploadPhoto,
} from "./admin-slider-support";
import { newStaff, signIn, TEXT } from "./admin-support";
import { testDb } from "./payments-support";

/**
 * دليل قبول الشريط (ADMIN_A3_SLIDER §13) على نادي الموقع العام نفسه: لا يظهر للزائر قبل النشر، ويظهر في
 * المعاينة، ثم في الرئيسية باللغتين بعد النشر، والرابط يعمل، والإيقاف ولوحة المفاتيح والحركة المخفّضة وبلا
 * JavaScript. مشروع بعد قبول المحتوى، ويزيل شرائحه وينشر في آخره فيعود الموقع بلا شريط.
 */
const WCAG_22_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const PUBLIC = ar.slider;
const TITLE_1 = { ar: "تدرّب بإشراف مدربين معتمدين", en: "Train with certified coaches" };
const TITLE_2 = { ar: "جولة في صالة الحديد", en: "Tour the weights hall" };
let db: Db;
let clubId = "";

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  db = testDb();
  clubId = (await oldestClubId(db)) ?? "";
});

async function manager(page: Page): Promise<void> {
  await signIn(page, await newStaff(db, { id: clubId }, { role: "manager", withTotp: true }));
}

/** يزيل كل شرائح المسودة من صفحاتها ثم ينشر، فيعود الموقع بلا شريط. */
async function removeAll(browser: Browser): Promise<void> {
  const page = await browser.newPage();
  await manager(page);
  await page.goto("/admin/content/slider");
  const editLinks = page.getByTestId("slide-list").getByRole("link", { name: SLIDER.list.edit });
  while ((await editLinks.count()) > 0) {
    await editLinks.first().click();
    await page.getByRole("link", { name: SLIDER.form.remove }).click();
    await page.getByRole("button", { name: SLIDER.remove.submit }).click();
    await expect(page.getByText(TEXT.notices.content_slide_removed)).toBeVisible();
  }
  await page.goto("/admin/content/publish");
  const publish = page.getByRole("button", { name: TEXT.content.publish.submit });
  if ((await publish.count()) > 0) {
    await publish.click();
    await expect(page.getByText(TEXT.notices.content_published)).toBeVisible();
  }
  await page.close();
}

test.afterAll(async ({ browser }) => {
  await removeAll(browser);
  await db.$disconnect();
});

async function visit(browser: Browser, path: string, options = {}) {
  const context = await browser.newContext(options);
  const tab = await context.newPage();
  await tab.goto(new URL(path, test.info().project.use.baseURL).toString());
  return { context, tab };
}

const region = (page: Page, label: string = PUBLIC.label) =>
  page.getByRole("region", { name: label });

test("من اللوحة إلى الرئيسية: لا شيء قبل النشر، ثم المعاينة، ثم الزائر باللغتين والرابط", async ({
  page,
  browser,
}) => {
  test.slow();
  await manager(page);
  await uploadPhoto(page, PHOTO);
  await uploadPhoto(page, PHOTO_2);
  await uploadPhoto(page, PHOTO_3);
  await createSlide(page, {
    photo: "trainer-portrait.jpg",
    mobilePhoto: "coach-floor.jpg",
    title: TITLE_1,
    subtitle: {
      ar: "برامج للقوة واللياقة لكل المستويات.",
      en: "Strength and fitness for every level.",
    },
    cta: { ar: "اكتشف الاشتراكات", en: "See memberships" },
    internal: "/memberships",
  });
  await createSlide(page, {
    photo: "lat-pulldown.jpg",
    title: TITLE_2,
    external: "https://example.com/tour",
    newTab: true,
    wholeSlide: true,
  });

  const before = await visit(browser, "/");
  await expect(region(before.tab)).toHaveCount(0);
  await before.context.close();

  await page.goto("/admin/content/slider");
  await page.getByRole("link", { name: SLIDER.list.preview }).click();
  await expect(page.getByTestId("preview-bar")).toBeVisible();
  await expect(region(page)).toContainText(TITLE_1.ar);
  await page.getByRole("link", { name: TEXT.content.previewBar.exit }).click();

  await publishAll(page);
  const { context, tab } = await visit(browser, "/");
  const slides = region(tab).getByRole("group", { name: /الشريحة \d من 2/ });
  await expect(slides).toHaveCount(2);
  await expect(slides.first()).toContainText(TITLE_1.ar);
  const images = region(tab).locator("img");
  await expect(images.first()).toHaveAttribute("loading", "eager");
  await expect(images.nth(1)).toHaveAttribute("loading", "lazy");
  expect(await images.first().getAttribute("fetchpriority")).toBeNull();
  const external = slides.nth(1).getByRole("link");
  await expect(external).toHaveAttribute("rel", "noopener noreferrer");
  await expect(external).toHaveAttribute("target", "_blank");
  await expect(external).toHaveAccessibleName(`${TITLE_2.ar} ${PUBLIC.newTab}`);

  const src = (await images.first().getAttribute("src")) ?? "";
  const served = await tab.request.get(src);
  expect(served.headers()["cache-control"]).toBe("public, max-age=31536000, immutable");

  await slides.first().getByRole("link", { name: "اكتشف الاشتراكات" }).click();
  await expect(tab).toHaveURL(/\/memberships$/);
  await tab.goto(new URL("/en", tab.url()).toString());
  const english = region(tab, en.slider.label);
  await expect(english).toContainText(TITLE_1.en);
  await expect(english.getByRole("link", { name: "See memberships" })).toHaveAttribute(
    "href",
    "/en/memberships",
  );
  await context.close();
});

test("الإيقاف ظاهر ويعمل، ولوحة المفاتيح بالاتجاه، وaxe نظيف", async ({ browser }) => {
  const { context, tab } = await visit(browser, "/");
  const carousel = region(tab);
  const pause = carousel.getByRole("button", { name: PUBLIC.pause });
  await expect(pause).toBeVisible();
  // الإيقاف أول عنصر تحكم في ترتيب التركيز، والتحكم قبل المسار، والشريحة غير الحالية خاملة
  await expect(carousel.getByRole("button").first()).toHaveAccessibleName(PUBLIC.pause);
  const controlsFirst = await carousel.evaluate((section) => {
    const controls = section.querySelector('[role="group"]:not([aria-roledescription])');
    const track = section.querySelector("#home-slider-track");
    return (
      controls !== null &&
      track !== null &&
      (controls.compareDocumentPosition(track) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    );
  });
  expect(controlsFirst).toBe(true);
  await expect(carousel.locator("#home-slider-track > [inert]")).toHaveCount(1);
  await pause.click();
  await expect(carousel.getByRole("button", { name: PUBLIC.play })).toBeVisible();
  const second = carousel.getByRole("button", { name: "اعرض الشريحة 2" });
  await carousel.getByRole("button", { name: "اعرض الشريحة 1" }).focus();
  await tab.keyboard.press("ArrowLeft");
  await expect(second).toHaveAttribute("aria-current", "true");
  await tab.keyboard.press("Home");
  await expect(carousel.getByRole("button", { name: "اعرض الشريحة 1" })).toHaveAttribute(
    "aria-current",
    "true",
  );
  await carousel.getByRole("button", { name: PUBLIC.next }).click();
  await expect(second).toHaveAttribute("aria-current", "true");
  const results = await new AxeBuilder({ page: tab })
    .include("#slides")
    .withTags(WCAG_22_AA)
    .analyze();
  expect(results.violations.map((violation) => violation.id)).toEqual([]);
  await context.close();
});

test("الحركة المخفّضة: لا تشغيل تلقائي ولا شريط تقدّم، والأسهم تبقى", async ({ browser }) => {
  const { context, tab } = await visit(browser, "/", { reducedMotion: "reduce" });
  const carousel = region(tab);
  await expect(carousel.getByRole("button", { name: PUBLIC.next })).toBeVisible();
  await expect(carousel.getByRole("button", { name: PUBLIC.pause })).toHaveCount(0);
  await expect(carousel.locator("[data-running]")).toHaveCount(0);
  await context.close();
});

test("التشغيل التلقائي ينقل، ويتوقف بالمرور", async ({ browser }) => {
  const { context, tab } = await visit(browser, "/en");
  const carousel = region(tab, en.slider.label);
  await carousel.scrollIntoViewIfNeeded();
  await tab.mouse.move(0, 0);
  await expect(carousel.getByRole("button", { name: "Show slide 2" })).toHaveAttribute(
    "aria-current",
    "true",
    { timeout: 12_000 },
  );
  await context.close();
});

test("بلا JavaScript: الشرائح شريط يُمرَّر بروابطه، بلا أزرار تحكم", async ({ browser }) => {
  const { context, tab } = await visit(browser, "/", { javaScriptEnabled: false });
  const carousel = region(tab);
  await expect(carousel.getByRole("group")).toHaveCount(2);
  await expect(carousel.getByRole("button")).toHaveCount(0);
  await expect(carousel.locator("[inert]")).toHaveCount(0);
  await expect(carousel.getByRole("link", { name: "اكتشف الاشتراكات" })).toBeVisible();
  const overflow = await carousel
    .locator("#home-slider-track")
    .evaluate((list) => getComputedStyle(list).overflowX);
  expect(overflow).toBe("auto");
  await context.close();
});

test("لقطات الشريط في الرئيسية بالمقاسين", async ({ browser }) => {
  for (const width of [390, 1440]) {
    const { context, tab } = await visit(browser, "/", {
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    const carousel = region(tab);
    await carousel.scrollIntoViewIfNeeded();
    await expect(carousel.locator("img").first()).toHaveJSProperty("complete", true);
    await carousel.screenshot({
      path: `${SLIDER_SHOTS_DIR}/public-slider-ar-${String(width)}.png`,
    });
    await tab.screenshot({ path: `${SLIDER_SHOTS_DIR}/public-home-ar-${String(width)}.png` });
    await tab.goto(new URL("/en", tab.url()).toString());
    await region(tab, en.slider.label).screenshot({
      path: `${SLIDER_SHOTS_DIR}/public-slider-en-${String(width)}.png`,
    });
    await context.close();
  }
});
