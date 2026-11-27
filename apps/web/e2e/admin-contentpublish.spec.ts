import type { Db } from "@masar/db";
import { expect, test, type Page } from "@playwright/test";
import { navLinks, newClub, newStaff, signIn, TEXT, type Club } from "./admin-support";
import { testDb } from "./payments-support";

/**
 * النشر والسجل والاسترجاع في نادي اختبار (ADMIN_A3_CONTENT §8، WP4): مصفوفة الأدوار، والنشر بالفرق،
 * والسجل، والاسترجاع المرفوض والمسودة متغيرة. أثر ذلك في الموقع العام في `content-site.spec.ts`
 * (نادي المحتوى العام، بعد كل الاختبارات الأخرى).
 */
const CONTENT = TEXT.content;
let db: Db;

test.beforeAll(() => {
  db = testDb();
});

test.afterAll(async () => {
  await db.$disconnect();
});

async function status(page: Page, path: string): Promise<number | undefined> {
  return (await page.goto(path))?.status();
}

async function editTitle(page: Page, value: string): Promise<void> {
  await page.goto("/admin/content/texts/hero");
  await page
    .locator("#text-hero\\.title")
    .getByLabel(`النص المعروض · ${CONTENT.locales.ar}`)
    .fill(value);
  await page.getByRole("button", { name: CONTENT.form.save }).click();
  await expect(page.getByText(TEXT.notices.content_draft_saved)).toBeVisible();
}

async function publish(page: Page): Promise<void> {
  await page.goto("/admin/content/publish");
  await page.getByRole("button", { name: CONTENT.publish.submit }).click();
  await expect(page.getByText(TEXT.notices.content_published)).toBeVisible();
}

async function signedIn(page: Page, club: Club, role: "owner" | "manager" | "editor" | "sales") {
  await page.context().clearCookies();
  await signIn(page, await newStaff(db, club, { role, withTotp: true }));
}

test("المحرر يكتب ولا ينشر، والمدير والمالك ينشران، والمبيعات لا ترى شيئًا من المحتوى", async ({
  page,
}) => {
  const club = await newClub(db);
  await signedIn(page, club, "editor");
  await editTitle(page, "عنوان المحرر");
  await page.goto("/admin/content");
  await expect(page.getByTestId("content-diff")).toContainText("عنوان المحرر");
  await expect(page.getByText(CONTENT.overview.editorNote)).toBeVisible();
  await expect(page.getByRole("link", { name: CONTENT.overview.publish })).toHaveCount(0);
  for (const path of ["/admin/content/publish", "/admin/content/discard"]) {
    expect(await status(page, path), path).toBe(404);
  }

  for (const role of ["manager", "owner"] as const) {
    await signedIn(page, club, role);
    expect(await status(page, "/admin/content/publish")).toBe(200);
  }

  await signedIn(page, club, "sales");
  expect(await navLinks(page)).not.toContain(CONTENT.nav.contentPublishing);
  for (const path of ["/admin/content", "/admin/content/publish", "/admin/content/history"]) {
    expect(await status(page, path), path).toBe(404);
  }
});

test("النشر بالفرق ثم السجل، والاسترجاع مرفوض والمسودة متغيرة ثم يعيد الإصدار ويستبدل المسودة", async ({
  page,
}) => {
  const club = await newClub(db);
  await signedIn(page, club, "manager");
  await editTitle(page, "العنوان الأول");
  await page.goto("/admin/content/publish");
  const diff = page.getByTestId("content-diff");
  await expect(diff).toContainText("أقوى نسخة منك");
  await expect(diff).toContainText("العنوان الأول");
  await page.getByRole("button", { name: CONTENT.publish.submit }).click();
  await expect(page.getByText(TEXT.notices.content_published)).toBeVisible();
  await expect(page.getByText(CONTENT.overview.draftClean).first()).toBeVisible();

  await editTitle(page, "العنوان الثاني");
  await publish(page);
  await editTitle(page, "غير منشور");

  await page.goto("/admin/content/history");
  const history = page.getByTestId("content-history");
  await expect(history.locator("tbody tr")).toHaveCount(2);
  await history.getByRole("link", { name: "افتح الإصدار 1" }).click();
  await expect(page.getByTestId("content-diff")).toContainText("العنوان الأول");
  await page.getByRole("link", { name: CONTENT.release.rollback }).click();
  await expect(page.getByText(CONTENT.rollback.dirtyTitle)).toBeVisible();
  await expect(page.getByRole("button", { name: CONTENT.rollback.submit })).toHaveCount(0);
  const rollbackUrl = page.url();

  await page.goto("/admin/content/discard");
  await page.getByRole("button", { name: CONTENT.discard.submit }).click();
  await expect(page.getByText(TEXT.notices.content_draft_discarded)).toBeVisible();

  await page.goto(rollbackUrl);
  await page.getByRole("button", { name: CONTENT.rollback.submit }).click();
  await expect(page.getByText(TEXT.notices.content_rolled_back)).toBeVisible();
  await expect(page.getByTestId("content-history")).toContainText("استرجاع الإصدار 1");
  await page.goto("/admin/content/texts/hero");
  await expect(
    page.locator("#text-hero\\.title").getByLabel(`النص المعروض · ${CONTENT.locales.ar}`),
  ).toHaveValue("العنوان الأول");
});
