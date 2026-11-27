import type { Db } from "@masar/db";
import { createDigitalProgram, insertRawOrder } from "@masar/db/test-support";
import { expect, test } from "@playwright/test";
import { newClub, newStaff, shell, signIn, TEXT, THEME_COOKIE, userMenu } from "./admin-support";
import { testDb } from "./payments-support";

/** هيكل اللوحة (الشريط الجانبي، الدرج، قائمة الحساب، المظهر والكثافة). «نظرة عامة» في admin-overview. */
const DESKTOP_MIN = 1024;
const NAV_COOKIE = "masar_admin_nav";

let db: Db;

test.beforeAll(() => {
  db = testDb();
});

test.afterAll(async () => {
  await db.$disconnect();
});

function isDesktop(width: number | undefined): boolean {
  return (width ?? 0) >= DESKTOP_MIN;
}

test("الشريط الجانبي يُطوى ويبقى مطويًّا بعد التحميل (من الخادم، بلا وميض)", async ({ page }) => {
  test.skip(!isDesktop(page.viewportSize()?.width), "الشريط الجانبي للشاشة الواسعة");
  const owner = await newStaff(db, await newClub(db), { withTotp: true });
  await signIn(page, owner);
  const sidebar = page.getByRole("complementary");
  const expandedWidth = (await sidebar.boundingBox())?.width ?? 0;

  await page.getByRole("button", { name: TEXT.shell.collapse }).click();
  await expect(shell(page)).toHaveAttribute("data-collapsed", "");
  expect((await sidebar.boundingBox())?.width ?? 0).toBeLessThan(expandedWidth / 2);
  const cookie = (await page.context().cookies()).find((entry) => entry.name === NAV_COOKIE);
  expect(cookie).toMatchObject({ value: "collapsed", path: "/admin" });

  // الخادم يرسم الحالة من الكوكي: السمة في HTML قبل أي سكربت
  const html = await (await page.request.get("/admin")).text();
  expect(html).toMatch(/data-admin-shell=""[^>]*data-collapsed=""/);
  await page.reload();
  await expect(shell(page)).toHaveAttribute("data-collapsed", "");
  // مطويّ: الأقسام تبقى بأسمائها لقارئ الشاشة ولوحة المفاتيح
  await expect(page.getByRole("link", { name: TEXT.nav.staff })).toBeVisible();

  const expand = page.getByRole("button", { name: TEXT.shell.expand });
  await expect(expand).toHaveAttribute("aria-expanded", "false");
  await expand.click();
  await expect(shell(page)).not.toHaveAttribute("data-collapsed", "");
  await page.reload();
  await expect(page.getByRole("button", { name: TEXT.shell.collapse })).toBeVisible();
});

test("على الهاتف: درج جانبي يُفتح ويُغلق بلوحة المفاتيح ويحبس التركيز", async ({ page }) => {
  test.skip(isDesktop(page.viewportSize()?.width), "الدرج للهاتف والجهاز اللوحي");
  const owner = await newStaff(db, await newClub(db), { withTotp: true });
  await signIn(page, owner);
  await expect(page.getByRole("complementary")).toBeHidden();
  const opener = page.getByRole("button", { name: TEXT.shell.openMenu });
  const drawer = page.getByRole("dialog", { name: TEXT.nav.label });
  await expect(drawer).toBeHidden();

  await opener.focus();
  await page.keyboard.press("Enter");
  await expect(drawer).toBeVisible();
  // التركيز داخل الدرج، ويبقى داخله مهما تكرر Tab
  for (let press = 0; press < 12; press += 1) {
    await page.keyboard.press("Tab");
    // الصفحة خلف الحوار خاملة: التركيز داخله، أو خرج إلى واجهة المتصفح (body) ليعود في الضغطة التالية
    const inside = await drawer.evaluate(
      (node) => node.contains(document.activeElement) || document.activeElement === document.body,
    );
    expect(inside).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(opener).toBeFocused();

  // اختيار قسم ينقل ويغلق الدرج
  await opener.click();
  await drawer.getByRole("link", { name: TEXT.nav.audit }).click();
  await expect(page).toHaveURL(/\/admin\/audit$/);
  await expect(drawer).toBeHidden();
  await expect(page.getByRole("heading", { level: 1, name: TEXT.audit.title })).toBeVisible();
});

test("قائمة الحساب: تُغلق بـEsc، والمظهر الفاتح يُحفظ ويرسمه الخادم", async ({ page }) => {
  const owner = await newStaff(db, await newClub(db), { withTotp: true });
  await signIn(page, owner);
  await page.goto("/admin/account?tab=sessions");
  const menu = userMenu(page);
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "dark");

  await menu.click();
  await expect(page.getByRole("link", { name: TEXT.nav.account }).last()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: TEXT.userMenu.themes.light })).toBeHidden();
  await expect(menu).toBeFocused();

  await menu.click();
  await page.getByRole("button", { name: TEXT.userMenu.themes.light }).click();
  await expect(html).toHaveAttribute("data-theme", "light");
  // يعود إلى الصفحة نفسها بتبويبها
  await expect(page).toHaveURL(/\/admin\/account\?tab=sessions$/);
  const cookie = (await page.context().cookies()).find((entry) => entry.name === THEME_COOKIE);
  expect(cookie).toMatchObject({ value: "light", httpOnly: true });
  expect(await (await page.request.get("/admin/login")).text()).toContain('data-theme="light"');

  await menu.click();
  await page.getByRole("button", { name: TEXT.userMenu.themes.dark }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");
});

test("مسار التنقل ورابط الموقع في الشريط العلوي", async ({ page }) => {
  const owner = await newStaff(db, await newClub(db), { withTotp: true });
  await signIn(page, owner);
  await page.goto("/admin/staff/new");
  const crumbs = page.getByRole("navigation", { name: TEXT.breadcrumbs.label });
  await expect(crumbs.locator('[aria-current="page"]')).toHaveText(TEXT.staffNew.title);
  if (isDesktop(page.viewportSize()?.width)) {
    await crumbs.getByRole("link", { name: TEXT.nav.staff }).click();
    await expect(page).toHaveURL(/\/admin\/staff$/);
  }
  const site = page.getByRole("link", { name: new RegExp(TEXT.nav.viewSite) });
  await expect(site).toHaveAttribute("href", "/");
  await expect(site).toHaveAttribute("target", "_blank");
  await expect(site).toHaveAttribute("rel", "noopener");
});

test("الكثافة المضغوطة تُحفظ ويرسمها الخادم على html بلا وميض", async ({ page }) => {
  const owner = await newStaff(db, await newClub(db), { withTotp: true });
  await signIn(page, owner);
  await page.goto("/admin/audit");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-density", "comfortable");
  await userMenu(page).click();
  await page.getByRole("button", { name: TEXT.shell.density.compact }).click();
  await expect(html).toHaveAttribute("data-density", "compact");
  await expect(page).toHaveURL(/\/admin\/audit$/);
  expect(await (await page.request.get("/admin/audit")).text()).toContain('data-density="compact"');
  await page.reload();
  await expect(html).toHaveAttribute("data-density", "compact");
  await userMenu(page).click();
  await page.getByRole("button", { name: TEXT.shell.density.comfortable }).click();
  await expect(html).toHaveAttribute("data-density", "comfortable");
});

test("الشريط الجانبي: النادي، وعدّاد «بانتظار الدفع» من القاعدة، و«حسابي» في قائمة الحساب", async ({
  page,
}) => {
  test.skip(!isDesktop(page.viewportSize()?.width), "الشريط الجانبي للشاشة الواسعة");
  const club = await newClub(db);
  const owner = await newStaff(db, club, { withTotp: true });
  const program = await createDigitalProgram(db, club.id, { priceMinor: 69_900 });
  const createdAt = new Date(Date.now() - 60_000);
  await insertRawOrder(db, {
    clubId: club.id,
    lines: [{ product: program }],
    createdAt,
    expiresAt: new Date(createdAt.getTime() + 3_600_000),
  });
  await signIn(page, owner);
  const sidebar = page.getByRole("complementary");
  await expect(sidebar).toContainText("نادي اختبار البيع");
  const nav = sidebar.getByRole("navigation", { name: TEXT.nav.label });
  await expect(nav.getByRole("link", { name: TEXT.nav.account })).toHaveCount(0);
  // العدّاد يصف الرابط ولا يدخل اسمه
  const orders = nav.getByRole("link", { name: TEXT.nav.orders, exact: true });
  await expect(orders).toHaveAccessibleDescription(
    TEXT.shell.counts.awaiting.replace("{count}", "1"),
  );
  // التعديلات المسودة صفر: لا عدّاد على «النصوص»
  await expect(nav.getByRole("link", { name: TEXT.nav.contentTexts })).toHaveAccessibleDescription(
    "",
  );
});
