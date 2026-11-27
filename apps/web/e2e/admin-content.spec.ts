import type { Db } from "@masar/db";
import { expect, test } from "@playwright/test";
import { navLinks, newClub, newStaff, signIn, TEXT } from "./admin-support";
import { testDb } from "./payments-support";

/** متصفح نصوص الموقع (ADMIN_A3_CONTENT §9، WP1): الأدوار، والشجرة، والبحث بلا JavaScript. */
const CONTENT = TEXT.content;
const TEXTS = "/admin/content/texts";

let db: Db;

test.beforeAll(() => {
  db = testDb();
});

test.afterAll(async () => {
  await db.$disconnect();
});

test("المحرر والمدير يريان متصفح النصوص، والمبيعات لا ترى شيئًا منه", async ({ page }) => {
  const club = await newClub(db);
  for (const role of ["editor", "manager"] as const) {
    const staff = await newStaff(db, club, { role, withTotp: true });
    await signIn(page, staff);
    expect(await navLinks(page)).toContain(CONTENT.nav.contentTexts);
    const response = await page.goto(TEXTS);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(CONTENT.texts.title);
    await page.context().clearCookies();
  }
  const sales = await newStaff(db, club, { role: "sales", withTotp: true });
  await signIn(page, sales);
  expect(await navLinks(page)).not.toContain(CONTENT.nav.contentTexts);
  for (const path of ["/admin/content", TEXTS, `${TEXTS}/hero`]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
  }
});

test.describe("بلا JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("الشجرة تفتح مساحة بنصوصها، والبحث يجد النص باللغتين والمسار", async ({ page }) => {
    const club = await newClub(db);
    await signIn(page, await newStaff(db, club, { role: "editor", withTotp: true }));
    await page.goto(TEXTS);
    const tree = page.getByRole("navigation", { name: CONTENT.texts.treeTitle });
    await tree.getByRole("link", { name: new RegExp(CONTENT.namespaces.hero) }).click();
    await expect(page).toHaveURL(/\/admin\/content\/texts\/hero$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(CONTENT.namespaces.hero);
    await expect(page.locator("#text-hero\\.title")).toContainText("أقوى نسخة منك");
    await expect(page.getByTestId("texts-locked")).toContainText(CONTENT.lockReasons.accessibility);

    for (const [query, path] of [
      ["المسبح الداخلي", "photos.pool"],
      ["Indoor pool", "about.features.2.title"],
      ["hero.slogan", "hero.slogan"],
    ] as const) {
      await page.goto(TEXTS);
      await page.getByLabel(CONTENT.texts.search).fill(query);
      await page.getByRole("button", { name: CONTENT.texts.submit }).click();
      await expect(page).toHaveURL(
        new RegExp(`q=${encodeURIComponent(query).replaceAll("%20", "\\+")}`),
      );
      await expect(page.getByTestId("texts-results")).toContainText(path);
    }
    await page.goto(`${TEXTS}?q=${encodeURIComponent("لا يوجد نص كهذا أبدًا")}`);
    await expect(page.getByText(CONTENT.texts.noResults)).toBeVisible();
  });
});

test("تعديل hero.title: رسالة التدقيق ثم التصحيح ثم الحفظ، بلا إصدار، ثم العودة إلى الافتراضي", async ({
  page,
}) => {
  const club = await newClub(db);
  await signIn(page, await newStaff(db, club, { role: "editor", withTotp: true }));
  await page.goto(`${TEXTS}/hero`);
  const title = page.locator("#text-hero\\.title");
  const arabic = title.getByLabel(`النص المعروض · ${CONTENT.locales.ar}`);
  await arabic.fill("أقوى  نسخة");
  await page.getByRole("button", { name: CONTENT.form.save }).click();
  await expect(title).toContainText("خطأ كتابة: مسافتان متتاليتان");
  await expect(arabic).toHaveValue("أقوى  نسخة");
  await arabic.fill("أقوى نسخة منك اليوم");
  await page.getByRole("button", { name: CONTENT.form.save }).click();
  await expect(page.getByText(TEXT.notices.content_draft_saved)).toBeVisible();
  await expect(title.getByLabel(`النص المعروض · ${CONTENT.locales.ar}`)).toHaveValue(
    "أقوى نسخة منك اليوم",
  );
  await expect(title).toContainText(CONTENT.statuses.draft);

  // الحفظ في المسودة لا يُنشئ إصدارًا: الموقع العام يقرأ الإصدارات وحدها
  expect(await db.contentRelease.count({ where: { clubId: club.id } })).toBe(0);

  await title.getByRole("button", { name: CONTENT.form.revert }).click();
  await expect(page.getByText(TEXT.notices.content_text_reverted)).toBeVisible();
  await expect(title.getByLabel(`النص المعروض · ${CONTENT.locales.ar}`)).toHaveValue(
    "أقوى نسخة منك",
  );
});
