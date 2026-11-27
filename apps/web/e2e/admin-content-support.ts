import { expect, type Page } from "@playwright/test";
import { TEXT } from "./admin-support";

/** عدّة اختبارات المحتوى في اللوحة: حفظ نص في المسودة، والنشر، وفتح إصدار. */
export const CONTENT = TEXT.content;

export function textField(page: Page, path: string, locale: "ar" | "en" = "ar") {
  return page
    .locator(`#text-${path.replaceAll(".", "\\.")}`)
    .getByLabel(`النص المعروض · ${CONTENT.locales[locale]}`);
}

export async function saveText(page: Page, path: string, value: string): Promise<void> {
  await page.goto(`/admin/content/texts/${path.split(".")[0] ?? ""}`);
  await textField(page, path).fill(value);
  await page.getByRole("button", { name: CONTENT.form.save }).click();
  await expect(page.getByText(TEXT.notices.content_draft_saved)).toBeVisible();
}

export async function publishDraft(page: Page): Promise<void> {
  await page.goto("/admin/content/publish");
  await page.getByRole("button", { name: CONTENT.publish.submit }).click();
  await expect(page.getByText(TEXT.notices.content_published)).toBeVisible();
}

/** رابط صفحة الإصدار برقمه من السجل. */
export async function releaseUrl(page: Page, seq: number): Promise<string> {
  await page.goto("/admin/content/history");
  await page.getByRole("link", { name: `افتح الإصدار ${String(seq)}` }).click();
  await expect(page).toHaveURL(/\/admin\/content\/history\/[0-9a-f-]{36}$/);
  return new URL(page.url()).pathname;
}
