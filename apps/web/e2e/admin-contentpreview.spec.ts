import type { Db } from "@masar/db";
import { expect, test, type Page } from "@playwright/test";
import { newClub, newStaff, signIn, signOut, TEXT } from "./admin-support";
import { testDb } from "./payments-support";

/**
 * معاينة المحتوى (ADMIN_A3_CONTENT §8.3، WP5) في نادي اختبار: الموظف يرى مسودة ناديه على الصفحات
 * العامة بشريطها وترويسات no-store وnoindex؛ الكوكي نفسه بلا جلسة يرى المنشور؛ الخروج والخروج من
 * اللوحة ينهيانها؛ وخريطة الموقع وllms.txt لا تتأثران.
 */
const CONTENT = TEXT.content;
const PREVIEW_COOKIE = "masar_preview";
const TITLE = "عنوان المعاينة";
let db: Db;

test.beforeAll(() => {
  db = testDb();
});

test.afterAll(async () => {
  await db.$disconnect();
});

async function saveDraftTitle(page: Page): Promise<void> {
  await page.goto("/admin/content/texts/hero");
  await page
    .locator("#text-hero\\.title")
    .getByLabel(`النص المعروض · ${CONTENT.locales.ar}`)
    .fill(TITLE);
  await page.getByRole("button", { name: CONTENT.form.save }).click();
  await expect(page.getByText(TEXT.notices.content_draft_saved)).toBeVisible();
}

const withoutNonce = (csp: string | undefined) => (csp ?? "").replace(/'nonce-[^']+'/g, "'nonce'");

test("الموظف يعاين المسودة بشريطها وترويساتها، وغيره بالكوكي نفسه يرى المنشور", async ({
  page,
  browser,
  request,
}) => {
  const club = await newClub(db);
  await signIn(page, await newStaff(db, club, { role: "editor", withTotp: true }));
  await saveDraftTitle(page);
  const plain = await request.get("/");

  await page.goto("/admin/content");
  await page.getByRole("link", { name: CONTENT.preview.draft }).click();
  await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(TITLE);
  await expect(page.getByTestId("preview-bar")).toContainText(CONTENT.previewBar.draft);
  const previewed = await page.request.get("/");
  expect(previewed.headers()["cache-control"]).toBe("private, no-store");
  expect(previewed.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  expect(withoutNonce(previewed.headers()["content-security-policy"])).toBe(
    withoutNonce(plain.headers()["content-security-policy"]),
  );
  expect(await previewed.text()).toContain(TITLE);

  const cookie = (await page.context().cookies()).find((item) => item.name === PREVIEW_COOKIE);
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Strict", path: "/" });
  const visitor = await browser.newContext();
  await visitor.addCookies(cookie === undefined ? [] : [cookie]);
  const stranger = await visitor.newPage();
  const response = await stranger.goto("/");
  expect(response?.headers()["cache-control"]).toBe("private, no-store");
  await expect(stranger.getByRole("heading", { level: 1 })).not.toContainText(TITLE);
  await expect(stranger.getByTestId("preview-bar")).toHaveCount(0);
  await visitor.close();

  for (const path of ["/llms.txt", "/sitemap.xml"]) {
    const withCookie = await page.request.get(path);
    expect(await withCookie.text(), path).toBe(await (await request.get(path)).text());
  }

  await page.getByRole("link", { name: CONTENT.previewBar.exit }).click();
  await expect(page).toHaveURL(/\/admin\/content$/);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).not.toContainText(TITLE);
  await expect(page.getByTestId("preview-bar")).toHaveCount(0);
});

test("الخروج من اللوحة ينهي المعاينة، ومعاينة إصدار بشريط رقمه، وهدف نادٍ آخر 404", async ({
  page,
}) => {
  const club = await newClub(db);
  const manager = await newStaff(db, club, { role: "manager", withTotp: true });
  await signIn(page, manager);
  await saveDraftTitle(page);
  await page.goto("/admin/content/publish");
  await page.getByRole("button", { name: CONTENT.publish.submit }).click();
  await expect(page.getByText(TEXT.notices.content_published)).toBeVisible();
  await page.goto("/admin/content/history");
  await page.getByRole("link", { name: "افتح الإصدار 1" }).click();
  const releaseUrl = page.url();
  await page.getByRole("link", { name: CONTENT.preview.release }).click();
  await expect(page.getByTestId("preview-bar")).toContainText("معاينة الإصدار رقم 1");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(TITLE);

  await page.goto("/admin");
  await signOut(page);
  await page.goto("/");
  await expect(page.getByTestId("preview-bar")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).not.toContainText(TITLE);

  const other = await newClub(db);
  await signIn(page, await newStaff(db, other, { role: "manager", withTotp: true }));
  const releaseId = releaseUrl.split("/").at(-1) ?? "";
  const response = await page.goto(`/admin/content/preview?target=${releaseId}`);
  expect(response?.status()).toBe(404);
});

test("المبيعات لا تبدأ معاينة", async ({ page }) => {
  const club = await newClub(db);
  await signIn(page, await newStaff(db, club, { role: "sales", withTotp: true }));
  const response = await page.goto("/admin/content/preview?target=draft");
  expect(response?.status()).toBe(404);
  expect((await page.context().cookies()).some((item) => item.name === PREVIEW_COOKIE)).toBe(false);
});
