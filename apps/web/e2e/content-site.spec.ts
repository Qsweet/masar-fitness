import { oldestClubId, type Db } from "@masar/db";
import { expect, test, type Page } from "@playwright/test";
import { newStaff, signIn, TEXT } from "./admin-support";
import { testDb } from "./payments-support";

/**
 * دليل القبول (ADMIN_A3_CONTENT §11، WP4 وWP5) على نادي المحتوى العام نفسه: تعديل لا يظهر للزائر قبل
 * النشر، ويظهر في المعاينة، ويظهر للزائر بعد النشر، ويختفي بعد الاسترجاع. يعمل في مشروع أخير بعد كل
 * المشاريع الأخرى (لا تتغير نصوص الموقع تحت اختبار يقرؤها)، ويعيد الموقع إلى نصوصه الافتراضية في آخره.
 */
const CONTENT = TEXT.content;
const STAMP = String(Date.now()).slice(-6);
const SLOGAN = `تبدأ معنا ${STAMP}.`;
const TITLE = `قبول المحتوى ${STAMP}`;
let db: Db;

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  db = testDb();
});

test.afterAll(async () => {
  await db.$disconnect();
});

async function fieldFor(page: Page, path: string) {
  await page.goto("/admin/content/texts/hero");
  return page
    .locator(`#text-${path.replace(".", "\\.")}`)
    .getByLabel(`النص المعروض · ${CONTENT.locales.ar}`);
}

async function save(page: Page, path: string, value: string): Promise<void> {
  await (await fieldFor(page, path)).fill(value);
  await page.getByRole("button", { name: CONTENT.form.save }).click();
  await expect(page.getByText(TEXT.notices.content_draft_saved)).toBeVisible();
}

async function publish(page: Page): Promise<void> {
  await page.goto("/admin/content/publish");
  await page.getByRole("button", { name: CONTENT.publish.submit }).click();
  await expect(page.getByText(TEXT.notices.content_published)).toBeVisible();
}

async function visitorHeading(page: Page): Promise<string> {
  const visitor = await page.context().browser()?.newContext();
  const tab = await visitor?.newPage();
  await tab?.goto(new URL("/", page.url()).toString());
  const heading = (await tab?.getByRole("heading", { level: 1 }).textContent()) ?? "";
  await visitor?.close();
  return heading;
}

test("تعديل يظهر في المعاينة قبل النشر، وللزائر بعد النشر فقط، ويختفي بعد الاسترجاع", async ({
  page,
}) => {
  test.slow();
  const clubId = await oldestClubId(db);
  expect(clubId).not.toBeNull();
  await signIn(page, await newStaff(db, { id: clubId ?? "" }, { role: "manager", withTotp: true }));

  // إصدار أساس: الشعار وحده معدَّل، فالاسترجاع إليه يعيد العنوان الافتراضي
  await save(page, "hero.slogan", SLOGAN);
  await publish(page);
  const base = page.url();
  expect(base).toMatch(/\/admin\/content\?done=/);

  await save(page, "hero.title", TITLE);
  expect(await visitorHeading(page)).not.toContain(TITLE);
  await page.goto("/admin/content");
  await page.getByRole("link", { name: CONTENT.preview.draft }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(TITLE);
  await expect(page.getByTestId("preview-bar")).toBeVisible();
  await page.getByRole("link", { name: CONTENT.previewBar.exit }).click();

  await publish(page);
  const published = await visitorHeading(page);
  expect(published).toContain(TITLE);
  expect(published).toContain(SLOGAN);

  await page.goto("/admin/content/history");
  const rows = page.getByTestId("content-history").locator("tbody tr");
  await rows.nth(1).getByRole("link").click();
  await page.getByRole("link", { name: CONTENT.release.rollback }).click();
  await page.getByRole("button", { name: CONTENT.rollback.submit }).click();
  await expect(page.getByText(TEXT.notices.content_rolled_back)).toBeVisible();
  const rolledBack = await visitorHeading(page);
  expect(rolledBack).not.toContain(TITLE);
  expect(rolledBack).toContain(SLOGAN);

  // الموقع يعود إلى نصوصه الافتراضية: الشعار إلى أصله وينشر
  await page.goto("/admin/content/texts/hero");
  await page
    .locator("#text-hero\\.slogan")
    .getByRole("button", { name: CONTENT.form.revert })
    .first()
    .click();
  await expect(page.getByText(TEXT.notices.content_text_reverted)).toBeVisible();
  await publish(page);
  const restored = await visitorHeading(page);
  expect(restored).not.toContain(SLOGAN);
  expect(restored).toContain("أقوى نسخة منك");
});
