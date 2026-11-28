import type { Db } from "@masar/db";
import { expect, test } from "@playwright/test";
import { field, SETTINGS } from "./admin-catalog-support";
import {
  SALES,
  seedLapsedOrder,
  seedPaidOrder,
  seedPendingOrder,
  seedPlan,
} from "./admin-sales-support";
import { newClub, newStaff, signIn, TEXT } from "./admin-support";
import { testDb } from "./payments-support";

/**
 * عدّة الصفحات الداخلية v2 (القرار 92): شريط الحفظ يظهر مع التعديل ويحرس المغادرة ويُتجاهَل ويرسل
 * بـ⌘S؛ وتبويبات الطلبات بعدّاداتها، والصف كله رابط.
 */
const KIT = TEXT.kit;
const DESKTOP = 1440;

let db: Db;

test.beforeAll(() => {
  db = testDb();
});

test.afterAll(async () => {
  await db.$disconnect();
});

test("شريط الحفظ: يظهر مع التعديل، ويعترض المغادرة، و«تجاهل» يعيد القيمة، و⌘S يرسل", async ({
  page,
}) => {
  test.skip(page.viewportSize()?.width !== DESKTOP, "روابط الشريط الجانبي في الدرج على الهاتف");
  const club = await newClub(db);
  await signIn(page, await newStaff(db, club, { withTotp: true }));
  await page.goto("/admin/sales/settings");
  const status = page.getByText(KIT.saveBar.dirty);
  await expect(status).toHaveCount(0);
  const saved = await field(page, SETTINGS.window.label).inputValue();

  await field(page, SETTINGS.window.label).fill("45");
  await expect(status).toBeVisible();

  // رابط داخلي مع تعديل غير محفوظ: حوار، و«ابقَ هنا» يبقي الصفحة والقيمة
  await page.getByRole("link", { name: TEXT.nav.audit }).first().click();
  const dialog = page.getByRole("dialog", { name: KIT.leave.title });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: KIT.leave.stay }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/admin\/sales\/settings$/);
  await expect(field(page, SETTINGS.window.label)).toHaveValue("45");

  await page.getByRole("button", { name: KIT.saveBar.discard }).click();
  await expect(field(page, SETTINGS.window.label)).toHaveValue(saved);
  await expect(status).toHaveCount(0);

  await field(page, SETTINGS.window.label).fill("60");
  await page.keyboard.press("ControlOrMeta+KeyS");
  await expect(page.getByTestId("form-review")).toContainText("60 دقيقة");

  // «غادر بلا حفظ» يتبع الرابط المطلوب
  await page.getByRole("button", { name: SETTINGS.confirm.edit }).click();
  await field(page, SETTINGS.window.label).fill("90");
  await page.getByRole("link", { name: TEXT.nav.audit }).first().click();
  await page.getByRole("button", { name: KIT.leave.leave }).click();
  await expect(page).toHaveURL(/\/admin\/audit$/);
});

test("الطلبات: تبويبات بعدّاد حالتها، والنقر في أي مكان من الصف يفتح الطلب", async ({ page }) => {
  const club = await newClub(db);
  const plan = await seedPlan(db, club);
  const pending = await seedPendingOrder(db, plan);
  await seedPaidOrder(db, plan);
  await seedLapsedOrder(db, club, plan);
  await signIn(page, await newStaff(db, club, { role: "sales", withTotp: true }));
  await page.goto("/admin/sales/orders");
  const tabs = page.getByRole("navigation", { name: SALES.orders.tabsLabel });
  for (const [tab, count] of [
    ["all", "3"],
    ["awaiting", "1"],
    ["paid", "1"],
    ["expired", "1"],
    ["cancelled", "0"],
  ] as const) {
    await expect(tabs.getByRole("link", { name: SALES.orders.tabs[tab] })).toContainText(count);
  }
  await page
    .getByTestId("orders-table")
    .getByRole("row")
    .filter({ hasText: pending.reference })
    .getByText(pending.name)
    // طبقة رابط الصف فوق الخلية: النقر يصلها (هذا المقصود)، فلا ينتظر فحصُ «قابلية النقر» الخليةَ
    .click({ force: true });
  await expect(page).toHaveURL(new RegExp(`/admin/sales/orders/${pending.orderId}$`));
});
