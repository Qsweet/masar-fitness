import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { oldestClubId, type Db } from "@masar/db";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { SLIDE_KIT } from "../src/content/slider-kit/kit";
import { ar } from "../src/i18n/dictionaries/ar";
import { en } from "../src/i18n/dictionaries/en";
import { KIT_MESSAGES } from "../src/server/slider-kit/messages";
import { mediaEnv } from "./admin-env";
import { publishAll, SLIDER, SLIDER_SHOTS_DIR } from "./admin-slider-support";
import { newStaff, signIn, TEXT } from "./admin-support";
import { testDb } from "./payments-support";

/**
 * عدّة إطلاق الشريط من أولها إلى الزائر (docs/SLIDER_KIT.md §4): الأمر نفسه الذي يشغّله المالك على
 * الخادم بقاعدة خادم اللوحة ومجلد صوره، ثم المعاينة، ثم النشر من اللوحة، ثم الشرائح الخمس في الرئيسية
 * باللغتين ولقطاتها. مشروع بعد `content-slider`، ويزيل شرائحه وينشر في آخره.
 */
const run = promisify(execFile);
const TOTAL = SLIDE_KIT.length;
const REMOVE_TIMEOUT = 120_000;
const [FIRST] = SLIDE_KIT;
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

/** الأمر كما على الخادم، ببيئة خادم اللوحة (القاعدة ومجلد الصور)، ورمز خروجه ونصه. */
async function launchKit(uploads: boolean) {
  const baseURL = test.info().project.use.baseURL ?? "";
  const media = mediaEnv(Number(new URL(baseURL).port));
  const env = {
    ...process.env,
    SITE_URL: baseURL,
    MEDIA_DIR: media.MEDIA_DIR,
    MEDIA_UPLOADS: uploads ? media.MEDIA_UPLOADS : "",
  };
  return run("pnpm", ["slider:launch-kit"], { env }).then(
    ({ stdout }) => ({ code: 0, stdout }),
    (error: unknown) => {
      const failed = error as { code?: number; stdout?: string };
      return { code: failed.code ?? -1, stdout: failed.stdout ?? "" };
    },
  );
}

async function removeKit(browser: Browser): Promise<void> {
  const page = await browser.newPage();
  await manager(page);
  await page.goto("/admin/content/slider");
  const edit = page.getByTestId("slide-list").getByRole("link", { name: SLIDER.list.edit });
  while ((await edit.count()) > 0) {
    await edit.first().click();
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
  // خمس إزالات ثم نشر: أطول من مهلة الخطاف الافتراضية
  test.setTimeout(REMOVE_TIMEOUT);
  await removeKit(browser);
  await db.$disconnect();
});

const region = (page: Page, label: string) => page.getByRole("region", { name: label });

test("الأمر يرفض بلا علم الرفع، ثم ينشئ المسودة وحدها، وتكراره لا يضيف شيئًا", async () => {
  test.slow();
  await newStaff(db, { id: clubId }, { role: "owner" });
  const refused = await launchKit(false);
  expect(refused.code).toBe(1);
  expect(refused.stdout).toContain(KIT_MESSAGES.uploadsOff);
  const before = await db.contentRelease.count({ where: { clubId } });
  const first = await launchKit(true);
  expect(first.code).toBe(0);
  expect(first.stdout).toContain(KIT_MESSAGES.done);
  const again = await launchKit(true);
  expect(again.stdout.match(/لم تُكرر/g)).toHaveLength(TOTAL);
  expect(await db.contentSlide.count({ where: { clubId } })).toBe(TOTAL);
  expect(await db.contentRelease.count({ where: { clubId } })).toBe(before);
});

test("الزائر لا يرى شيئًا قبل النشر، والمعاينة تعرض العدّة، ثم النشر يظهرها باللغتين", async ({
  page,
  browser,
}) => {
  const visitor = await browser.newPage();
  await visitor.goto("/");
  await expect(region(visitor, ar.slider.label)).toHaveCount(0);
  await manager(page);
  await page.goto("/admin/content/slider");
  await page.getByRole("link", { name: SLIDER.list.preview }).click();
  await expect(page.getByTestId("preview-bar")).toBeVisible();
  await expect(region(page, ar.slider.label)).toContainText(FIRST?.texts.ar.title ?? "");
  await page.getByRole("link", { name: TEXT.content.previewBar.exit }).click();
  await publishAll(page);

  await visitor.goto("/");
  const slides = region(visitor, ar.slider.label).getByRole("group", { name: /الشريحة \d من 5/ });
  await expect(slides).toHaveCount(TOTAL);
  for (const [index, slide] of SLIDE_KIT.entries()) {
    await expect(slides.nth(index)).toContainText(slide.texts.ar.title);
  }
  await visitor.goto("/en");
  const english = region(visitor, en.slider.label);
  await expect(english.getByRole("group", { name: /Slide \d of 5/ })).toHaveCount(TOTAL);
  await expect(english).toContainText(FIRST?.texts.en.title ?? "");
  await expect(english.getByRole("link").first()).toHaveAttribute("href", "/en#services");
  await visitor.close();
});

test("لقطات العدّة في الرئيسية: 390 و1440 باللغتين، وكل شريحة على الحاسوب والهاتف", async ({
  browser,
}) => {
  test.slow();
  for (const width of [390, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    const tab = await context.newPage();
    for (const [locale, label] of [
      ["ar", ar.slider.label],
      ["en", en.slider.label],
    ] as const) {
      await tab.goto(locale === "ar" ? "/" : "/en");
      const carousel = region(tab, label);
      await carousel.scrollIntoViewIfNeeded();
      for (let index = 0; index < TOTAL; index += 1) {
        await carousel.getByRole("button", { name: new RegExp(` ${String(index + 1)}$`) }).click();
        const image = carousel.locator(`[data-slide="${String(index)}"] img`);
        await image.scrollIntoViewIfNeeded();
        await expect(image).toHaveJSProperty("complete", true);
        await carousel.screenshot({
          path: `${SLIDER_SHOTS_DIR}/kit-${locale}-${String(width)}-${String(index + 1)}.png`,
        });
      }
    }
    await context.close();
  }
});
