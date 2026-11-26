import AxeBuilder from "@axe-core/playwright";
import type { Db } from "@masar/db";
import { expect, test, type Page } from "@playwright/test";
import {
  orderUrl,
  SALES,
  seedLapsedOrder,
  seedPaidOrder,
  seedPendingOrder,
  seedPlan,
} from "./admin-sales-support";
import { formAlert, newClub, newStaff, setTheme, signIn } from "./admin-support";
import { testDb } from "./payments-support";

/** فحص WCAG 2.2 AA الآلي (axe) لصفحات المبيعات في المظهرين، بمقاسي المشروعين. */
const WCAG_22_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const THEMES = ["dark", "light"] as const;
const text = SALES.orders.settle;

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
      `${violation.id} (${violation.impact ?? "?"}): ${violation.nodes.map((node) => node.target.join(" ")).join(" | ")}`,
  );
  expect(summary, name).toEqual([]);
}

test("صفحات المبيعات بلا مخالفات وصول آلية في المظهرين", async ({ page }) => {
  test.slow();
  const club = await newClub(db);
  const plan = await seedPlan(db, club);
  const owner = await newStaff(db, club, { withTotp: true });
  const pending = await seedPendingOrder(db, plan);
  const paid = await seedPaidOrder(db, plan);
  const lapsed = await seedLapsedOrder(db, club, plan);
  await signIn(page, owner);
  const pages = [
    "/admin/sales/orders",
    "/admin/sales/orders?tab=cancelled",
    "/admin/sales/orders?reference=abc",
    orderUrl(pending),
    orderUrl(paid),
    orderUrl(lapsed),
    `${orderUrl(pending)}/cancel`,
    `${orderUrl(pending)}/settle`,
    `${orderUrl(paid)}/settle`,
    "/admin/sales/customers",
    `/admin/sales/customers/${paid.customerId}`,
    "/admin/audit?entity=order",
  ];
  for (const theme of THEMES) {
    await setTheme(page, theme);
    for (const path of pages) {
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expectAccessible(page, `${theme} ${path}`);
    }
    // حالات لا تُفتح برابط: خطأ الخطوة الأولى، وخطوة التأكيد، والرقم المكشوف
    await page.goto(`${orderUrl(pending)}/settle`);
    await page.getByLabel(text.reference).fill("TRF-1");
    await page.getByLabel(text.amount).fill("12");
    await page.getByRole("button", { name: text.review, exact: true }).click();
    await expect(formAlert(page)).toBeVisible();
    await expectAccessible(page, `${theme} settle error`);
    await page.getByLabel(text.amount).fill("1499");
    await page.getByRole("button", { name: text.review, exact: true }).click();
    await expect(page.getByTestId("settle-restate")).toBeVisible();
    await expectAccessible(page, `${theme} settle confirm`);
    await page.goto(`/admin/sales/customers/${paid.customerId}`);
    await page.getByRole("button", { name: SALES.customers.reveal.submit }).click();
    await expect(page.getByTestId("revealed-phone")).toBeVisible();
    await expectAccessible(page, `${theme} revealed phone`);
  }
});

test("لوحة المفاتيح: نموذج البحث بالجوال يُرسل بـEnter، والتركيز ينتقل إلى الخطأ", async ({
  page,
}) => {
  const club = await newClub(db);
  await signIn(page, await newStaff(db, club, { role: "sales", withTotp: true }));
  await page.goto("/admin/sales/customers");
  const mobile = page.getByLabel(SALES.customers.lookup.mobile);
  await mobile.fill("0500000000");
  await mobile.press("Enter");
  await expect(formAlert(page)).toBeFocused();
});
