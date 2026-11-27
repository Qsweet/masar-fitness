import { expect, type Page } from "@playwright/test";
import { TEXT } from "./admin-support";

/**
 * عدّة اختبارات الشريط والمكتبة في المتصفح (ADMIN_A3_SLIDER §13): رفع صورة حقيقية من صور الموقع، وملء
 * نموذج الشريحة بأسماء حقوله من القاموس، والنشر. النصوص من قاموس اللوحة نفسه.
 */
export const SLIDER = TEXT.slider;
export const MEDIA = TEXT.media;
/** صور الموقع نفسها (لا محتوى مختلق): الأولى للحاسوب، والثانية للهاتف. */
export const PHOTO = "src/assets/photos/trainer-portrait.jpg";
export const PHOTO_2 = "src/assets/photos/lat-pulldown.jpg";
export const PHOTO_3 = "src/assets/photos/coach-floor.jpg";
/** مجلد لقطات الشريط (خارج git)، ويُغيَّر بمتغير لنسخها إلى مكان المراجعة. */
export const SLIDER_SHOTS_DIR = process.env.SLIDER_SHOTS_DIR ?? "screens/slider";

/** يرفع صورة من المكتبة ويرجع معرّفها من رابط صفحتها. */
export async function uploadPhoto(page: Page, path: string): Promise<string> {
  await page.goto("/admin/content/media");
  await page.getByLabel(MEDIA.file).setInputFiles(path);
  await page.getByRole("button", { name: MEDIA.submit, exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/content\/media\/[0-9a-f-]{36}\?done=/);
  return new URL(page.url()).pathname.split("/").at(-1) ?? "";
}

export interface SlideInput {
  readonly photo: string;
  readonly mobilePhoto?: string;
  readonly title?: { readonly ar: string; readonly en: string };
  readonly subtitle?: { readonly ar: string; readonly en: string };
  readonly cta?: { readonly ar: string; readonly en: string };
  readonly internal?: string;
  readonly external?: string;
  readonly newTab?: boolean;
  readonly wholeSlide?: boolean;
}

function field(page: Page, name: string, locale: "ar" | "en") {
  const label = `${SLIDER.form.fields[name as keyof typeof SLIDER.form.fields]} · ${TEXT.content.locales[locale]}`;
  return page.getByLabel(label, { exact: true });
}

async function fillPair(
  page: Page,
  name: string,
  value: { readonly ar: string; readonly en: string } | undefined,
) {
  if (value !== undefined) {
    await field(page, name, "ar").fill(value.ar);
    await field(page, name, "en").fill(value.en);
  }
}

/** صورة من منتقٍ باسم ملفها (المجموعة باسم الموضع). */
export async function pickImage(page: Page, legend: string, fileName: string): Promise<void> {
  await page.getByRole("group", { name: legend }).getByText(fileName).first().click();
}

async function fillLink(page: Page, input: SlideInput) {
  const kind = page.getByLabel(SLIDER.form.linkKind);
  if (input.internal !== undefined) {
    await kind.selectOption("internal");
    await page.getByLabel(SLIDER.form.internal).selectOption(input.internal);
  } else if (input.external !== undefined) {
    await kind.selectOption("external");
    await page.getByLabel(SLIDER.form.external).fill(input.external);
    if (input.newTab === true) {
      await page.getByLabel(SLIDER.form.newTab).check();
    }
  }
  if (input.wholeSlide === true) {
    await page.getByLabel(SLIDER.form.clickTargets.slide).check();
  }
}

/** يملأ نموذج الشريحة المفتوح (جديدة أو للتعديل) ولا يحفظ. */
export async function fillSlide(page: Page, input: SlideInput): Promise<void> {
  await pickImage(page, SLIDER.form.desktop, input.photo);
  if (input.mobilePhoto !== undefined) {
    await pickImage(page, SLIDER.form.mobile, input.mobilePhoto);
  }
  await page
    .getByLabel(`النص البديل · ${TEXT.content.locales.ar}`)
    .fill("مدرب النادي في صالة الحديد");
  await page
    .getByLabel(`النص البديل · ${TEXT.content.locales.en}`)
    .fill("A club coach in the weights hall");
  await fillPair(page, "title", input.title);
  await fillPair(page, "subtitle", input.subtitle);
  await fillPair(page, "cta", input.cta);
  await fillLink(page, input);
}

export async function createSlide(page: Page, input: SlideInput): Promise<void> {
  await page.goto("/admin/content/slider/new");
  await fillSlide(page, input);
  await page.getByRole("button", { name: SLIDER.form.create }).click();
  await expect(page.getByText(TEXT.notices.content_slide_created)).toBeVisible();
}

export async function publishAll(page: Page): Promise<void> {
  await page.goto("/admin/content/publish");
  await page.getByRole("button", { name: TEXT.content.publish.submit }).click();
  await expect(page.getByText(TEXT.notices.content_published)).toBeVisible();
}
