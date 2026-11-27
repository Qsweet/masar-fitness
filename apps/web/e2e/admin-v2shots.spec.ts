import type { Db } from "@masar/db";
import { expect, test, type Page } from "@playwright/test";
import { seedSales } from "./admin-overview-support";
import { shot, SHOT_DESKTOP, SHOT_HEIGHT, watchProblems } from "./admin-shots-support";
import { newClub, newStaff, setTheme, signIn, TEXT } from "./admin-support";
import { testDb } from "./payments-support";

/**
 * لقطات اللوحة v2 للمقارنة بالنماذج (ADMIN_REDESIGN §13): «نظرة عامة» بحالتيها، والطلبات، والنصوص،
 * ولوحة الأوامر، والدرج على الهاتف؛ بمقاسي النماذج (1440 و390) وبالمظهرين، في screens/admin. يفشل عند
 * تمرير أفقي أو خطأ console (ومنه مخالفات CSP).
 */
const WIDTHS = [1440, 390] as const;
const THEMES = ["dark", "light"] as const;

let db: Db;

test.beforeAll(() => {
  db = testDb();
});

test.afterAll(async () => {
  await db.$disconnect();
});

type Scene = (page: Page, width: number) => Promise<void>;

async function shootScene(page: Page, name: string, path: string, scene?: Scene): Promise<void> {
  for (const theme of THEMES) {
    await setTheme(page, theme);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: SHOT_HEIGHT });
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await scene?.(page, width);
      await shot(page, `v2-${name}-${theme}`);
    }
  }
}

const openPalette: Scene = async (page) => {
  await page.keyboard.press("Control+KeyK");
  await page.getByRole("combobox", { name: TEXT.shell.palette.input }).fill("ط");
};

const openDrawer: Scene = async (page, width) => {
  if (width < 1024) {
    await page.getByRole("button", { name: TEXT.shell.openMenu }).click();
  }
};

test("لقطات v2: نظرة عامة بحالتيها، والطلبات، والنصوص، ولوحة الأوامر، والدرج", async ({ page }) => {
  test.skip(
    page.viewportSize()?.width !== SHOT_DESKTOP,
    "اللقطات في مشروع واحد: الاختبار يغيّر المقاس",
  );
  test.setTimeout(240_000);
  const problems = watchProblems(page);
  const launch = await newClub(db);
  await signIn(page, await newStaff(db, launch, { withTotp: true, displayName: "خالد" }));
  await shootScene(page, "overview-launch", "/admin");

  const club = await newClub(db);
  await seedSales(db, club.id, new Date());
  await page.context().clearCookies();
  await signIn(page, await newStaff(db, club, { withTotp: true, displayName: "خالد" }));
  await shootScene(page, "overview-data", "/admin");
  await shootScene(page, "orders", "/admin/sales/orders");
  await shootScene(page, "content-texts", "/admin/content/texts");
  await shootScene(page, "palette", "/admin/sales/orders", openPalette);
  await shootScene(page, "drawer", "/admin", openDrawer);
  expect(problems).toEqual([]);
});
