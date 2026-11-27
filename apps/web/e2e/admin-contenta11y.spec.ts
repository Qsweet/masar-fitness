import AxeBuilder from "@axe-core/playwright";
import type { Db } from "@masar/db";
import { expect, test, type Page } from "@playwright/test";
import { CONTENT, publishDraft, releaseUrl, saveText, textField } from "./admin-content-support";
import { newClub, newStaff, setTheme, signIn } from "./admin-support";
import { testDb } from "./payments-support";

/** فحص WCAG 2.2 AA الآلي (axe) لصفحات المحتوى في المظهرين، ولشريط المعاينة على الصفحة العامة. */
const WCAG_22_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const THEMES = ["dark", "light"] as const;
/** بداية نص خطأ الحقل الفارغ من القاموس. */
const TEXT_EMPTY = "النص فارغ.";
let db: Db;

test.beforeAll(() => {
  db = testDb();
});

test.afterAll(async () => {
  await db.$disconnect();
});

async function expectAccessible(page: Page, name: string): Promise<void> {
  await expect(page).toHaveTitle(/\S/);
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

test("صفحات المحتوى بلا مخالفات وصول آلية في المظهرين، ومعها خطأ النموذج وشريط المعاينة", async ({
  page,
}) => {
  test.slow();
  const club = await newClub(db);
  await signIn(page, await newStaff(db, club, { role: "owner", withTotp: true }));
  await saveText(page, "hero.title", "عنوان أول");
  await publishDraft(page);
  await saveText(page, "hero.title", "عنوان ثانٍ");
  await publishDraft(page);
  const first = await releaseUrl(page, 1);
  await saveText(page, "hero.lead", "سطر في المسودة.");
  const pages = [
    "/admin/content",
    "/admin/content/texts",
    `/admin/content/texts?q=${encodeURIComponent("المسبح")}`,
    "/admin/content/texts/hero",
    "/admin/content/publish",
    "/admin/content/discard",
    "/admin/content/history",
    first,
    `${first}/rollback`,
  ];
  for (const theme of THEMES) {
    await setTheme(page, theme);
    for (const path of pages) {
      await page.goto(path);
      await expectAccessible(page, `${theme} ${path}`);
    }
    await page.goto("/admin/content/texts/hero");
    await textField(page, "hero.slogan").fill("");
    await page.getByRole("button", { name: CONTENT.form.save }).click();
    await expect(page.getByText(TEXT_EMPTY, { exact: false })).toBeVisible();
    await expectAccessible(page, `${theme} خطأ النموذج`);
  }
  await page.goto("/admin/content");
  await page.getByRole("link", { name: CONTENT.preview.draft }).click();
  await expect(page.getByTestId("preview-bar")).toBeVisible();
  await expectAccessible(page, "شريط المعاينة على الرئيسية");
  await page.goto("/en");
  await expect(page.getByTestId("preview-bar")).toBeVisible();
  await expectAccessible(page, "شريط المعاينة على الرئيسية الإنجليزية");
});
