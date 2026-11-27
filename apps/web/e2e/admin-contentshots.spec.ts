import { type Db } from "@masar/db";
import { expect, test } from "@playwright/test";
import { CONTENT, publishDraft, releaseUrl, saveText, textField } from "./admin-content-support";
import {
  SHOT_DESKTOP,
  SHOT_THEMES,
  shootAll,
  shootHere,
  SHOTS_DIR,
  watchProblems,
} from "./admin-shots-support";
import { newClub, newStaff, setTheme, signIn } from "./admin-support";
import { testDb } from "./payments-support";

/**
 * لقطات المحتوى (ADMIN_A3_CONTENT §9) بالمظهرين والمقاسات الأربعة: متصفح النصوص بشجرته وبحثه، المساحة
 * بالافتراضي والحقلين وأخطاء التحقق، حالة المسودة، الفرق قبل النشر، السجل والإصدار وتأكيد الاسترجاع،
 * تجاهل المسودة، وشريط المعاينة على الرئيسية باللغتين.
 */
let db: Db;
const PHONE = 390;
const HEIGHT = 900;

test.beforeAll(() => {
  db = testDb();
});

test.afterAll(async () => {
  await db.$disconnect();
});

test.beforeEach(({ page }) => {
  test.skip(
    page.viewportSize()?.width !== SHOT_DESKTOP,
    "اللقطات في مشروع واحد: الاختبار يغيّر المقاس",
  );
});

test("متصفح النصوص والتحرير والنشر والسجل والمعاينة بالمظهرين والمقاسات الأربعة", async ({
  page,
}) => {
  test.slow();
  const problems = watchProblems(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const club = await newClub(db);
  await signIn(page, await newStaff(db, club, { withTotp: true, displayName: "خالد المطيري" }));
  await saveText(page, "hero.title", "أقوى نسخة منك تبدأ اليوم");
  await publishDraft(page);
  await saveText(page, "hero.lead", "تجربة تدريب كاملة بإشراف مدربين معتمدين، من أول يوم.");
  await saveText(page, "meta.homeTitle", "نادي مسار الأبطال للرجال في بريدة: حديد وحصص ومسبح");

  await page.goto("/admin/content/texts");
  await shootAll(page, "content-texts");
  await page.goto(`/admin/content/texts?q=${encodeURIComponent("hero")}`);
  await shootAll(page, "content-texts-search");
  await page.goto("/admin/content/texts/hero");
  await shootAll(page, "content-namespace");
  for (const theme of SHOT_THEMES) {
    await setTheme(page, theme);
    await page.goto("/admin/content/texts/hero");
    await textField(page, "hero.slogan").fill("تبدأ  {هنا}");
    await textField(page, "hero.offerWith", "en").fill("With the membership");
    await page.getByRole("button", { name: CONTENT.form.save }).click();
    await expect(page.locator("form [role=alert]")).toBeVisible();
    await shootHere(page, "content-namespace-errors", theme);
  }
  await setTheme(page, "dark");
  for (const [name, path] of [
    ["content-overview", "/admin/content"],
    ["content-publish", "/admin/content/publish"],
    ["content-discard", "/admin/content/discard"],
    ["content-history", "/admin/content/history"],
  ] as const) {
    await page.goto(path);
    await shootAll(page, name);
  }
  const first = await releaseUrl(page, 1);
  await shootAll(page, "content-release");
  await page.goto(`${first}/rollback`);
  await shootAll(page, "content-rollback-dirty");

  await page.goto("/admin/content");
  await page.getByRole("link", { name: CONTENT.preview.draft }).click();
  await expect(page.getByTestId("preview-bar")).toBeVisible();
  for (const [name, path] of [
    ["content-preview-home-ar", "/"],
    ["content-preview-home-en", "/en"],
  ] as const) {
    await page.goto(path);
    for (const width of [PHONE, SHOT_DESKTOP]) {
      await page.setViewportSize({ width, height: HEIGHT });
      // الشريط أعلى الصفحة: لقطة الشاشة الأولى تكفي (الصفحة الكاملة أطول من أن تُراجع)
      await page.screenshot({ path: `${SHOTS_DIR}/${name}-${String(width)}.png` });
    }
  }
  expect(problems).toEqual([]);
});
