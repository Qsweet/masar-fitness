import type { Db } from "@masar/db";
import { createDigitalProgram, insertRawOrder } from "@masar/db/test-support";
import { expect, test } from "@playwright/test";
import {
  newClub,
  newStaff,
  shell,
  signIn,
  TEXT,
  THEME_COOKIE,
  userMenu,
  type Club,
} from "./admin-support";
import { testDb } from "./payments-support";

/** هيكل اللوحة (الشريط الجانبي، الدرج، قائمة الحساب، المظهر) و«نظرة عامة» بأرقام حقيقية. */
const DESKTOP_MIN = 1024;
const NAV_COOKIE = "masar_admin_nav";
const PRICE_MINOR = 69_900;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

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

/** طلبان اليوم (أحدهما مدفوع) وطلب مدفوع أمس، كلها على برنامج بسعر واحد. */
async function seedOrders(club: Club): Promise<void> {
  const program = await createDigitalProgram(db, club.id, { priceMinor: PRICE_MINOR });
  const now = Date.now();
  const rows = [
    { age: 60_000, phone: "+966500004321", paid: false },
    { age: 120_000, phone: "+966500008765", paid: true },
    { age: DAY_MS + HOUR_MS, phone: "+966500001111", paid: true },
  ];
  for (const row of rows) {
    const createdAt = new Date(now - row.age);
    const order = await insertRawOrder(db, {
      clubId: club.id,
      lines: [{ product: program }],
      phone: row.phone,
      createdAt,
      expiresAt: new Date(createdAt.getTime() + HOUR_MS),
    });
    if (row.paid) {
      await db.order.update({
        where: { id: order.orderId },
        data: {
          status: "paid",
          paidAt: new Date(createdAt.getTime() + 30_000),
          paidProvider: "fake",
          paidProviderPaymentId: `e2e-${order.orderId}`,
          paidAmountMinor: PRICE_MINOR,
          paidCurrency: "SAR",
        },
      });
    }
  }
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

test("نظرة عامة بأرقام حقيقية من القاعدة، وبلا جوال كامل", async ({ page }) => {
  const club = await newClub(db);
  const owner = await newStaff(db, club, { withTotp: true, displayName: "ليلى المالكة" });
  await seedOrders(club);
  await signIn(page, owner);

  await expect(page.getByTestId("kpi-created-value")).toHaveText("2");
  await expect(page.getByTestId("kpi-awaiting-value")).toHaveText("1");
  await expect(page.getByTestId("kpi-paid-value")).toHaveText("1");
  await expect(page.getByTestId("kpi-revenue-value")).toHaveText("699 ر.س");
  // أمس طلب واحد واليوم اثنان: الفرق له معنى فيُعرض
  await expect(page.getByTestId("kpi-created")).toContainText("100%");

  await expect(page.getByTestId("orders-chart")).toBeVisible();
  const rows = page.getByTestId("recent-orders").locator("tbody tr");
  await expect(rows).toHaveCount(3);
  await expect(rows.first()).toContainText("4321");
  await expect(rows.first()).toContainText(TEXT.overview.orderStatuses.pending_payment);
  await expect(rows.nth(1)).toContainText(TEXT.overview.orderStatuses.paid);
  expect(await page.content()).not.toContain("+9665");
  expect(await page.content()).not.toContain("0500004321");

  const feed = page.getByTestId("activity-feed");
  await expect(feed).toContainText("دخول ليلى المالكة إلى اللوحة");
  const system = page.getByTestId("system-status");
  await expect(system).toContainText(TEXT.overview.system.checkoutStates.closed);
  await expect(system).toContainText(TEXT.overview.system.paymentsOff);
  await expect(system).toContainText("1 من 1");
  await expect(system).toContainText("e2e");
});

test("نظرة عامة فارغة: حالات فارغة مصمَّمة لا أصفار متراكمة", async ({ page }) => {
  const owner = await newStaff(db, await newClub(db), { withTotp: true });
  await signIn(page, owner);
  await expect(page.getByTestId("kpi-created-value")).toHaveText("0");
  await expect(page.getByText(TEXT.overview.chart.emptyTitle)).toBeVisible();
  await expect(page.getByText(TEXT.overview.orders.emptyTitle)).toBeVisible();
  await expect(page.getByTestId("orders-chart")).toHaveCount(0);
});

test("كل دور يرى في «نظرة عامة» ما تسمح به صلاحياته فقط", async ({ browser }) => {
  const club = await newClub(db);
  await seedOrders(club);
  const visible = { manager: true, sales: false } as const;
  for (const role of ["manager", "sales"] as const) {
    const staff = await newStaff(db, club, { role, withTotp: true });
    const page = await (await browser.newContext()).newPage();
    await signIn(page, staff);
    await expect(page.getByTestId("kpi-created")).toBeVisible();
    await expect(page.getByTestId("recent-orders")).toBeVisible();
    await expect(page.getByTestId("system-status")).toHaveCount(visible[role] ? 1 : 0);
    await expect(page.getByTestId("activity-feed")).toHaveCount(visible[role] ? 1 : 0);
    await page.context().close();
  }
});
