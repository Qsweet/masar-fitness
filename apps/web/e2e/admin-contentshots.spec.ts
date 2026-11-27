import { type Db } from "@masar/db";
import { test } from "@playwright/test";
import { SHOT_DESKTOP, shootAll, watchProblems } from "./admin-shots-support";
import { newClub, newStaff, signIn } from "./admin-support";
import { testDb } from "./payments-support";
import { expect } from "@playwright/test";

/**
 * لقطات المحتوى (ADMIN_A3_CONTENT §9) بالمظهرين والمقاسات الأربعة: متصفح النصوص بشجرته وبحثه، صفحة
 * المساحة.
 */
let db: Db;

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

test("متصفح النصوص بالمظهرين والمقاسات الأربعة", async ({ page }) => {
  test.slow();
  const problems = watchProblems(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const club = await newClub(db);
  await signIn(page, await newStaff(db, club, { role: "manager", withTotp: true }));
  await page.goto("/admin/content/texts");
  await shootAll(page, "content-texts");
  await page.goto(`/admin/content/texts?q=${encodeURIComponent("المسبح")}`);
  await shootAll(page, "content-texts-search");
  await page.goto("/admin/content/texts/hero");
  await shootAll(page, "content-namespace");
  expect(problems).toEqual([]);
});
