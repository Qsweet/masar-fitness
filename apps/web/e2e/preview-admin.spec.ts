import type { Db } from "@masar/db";
import { expect, test } from "@playwright/test";
import { orderUrl, SALES, seedPendingOrder, seedPlan } from "./admin-sales-support";
import { newClub, newStaff, signIn } from "./admin-support";
import { testDb } from "./payments-support";

/**
 * اللوحة على خادم بعلم معاينة الشراء (CHECKOUT_PREVIEW): طلبات المعاينة للعرض فقط ولا تُعلَّم في
 * القاعدة (القرار 59)، فلا زر دفع يدوي ولا صفحة له، ولو كان الموظف مالكًا. رفض الإجراء نفسه قبل أي
 * قراءة مختبر وحدةً (`server/admin/sales/settle.test.ts`).
 */
let db: Db;

test.beforeAll(() => {
  db = testDb();
});

test.afterAll(async () => {
  await db.$disconnect();
});

test("في وضع المعاينة: المالك لا يرى زر الدفع اليدوي، ومساره 404، والإلغاء باقٍ", async ({
  page,
}) => {
  const club = await newClub(db);
  const order = await seedPendingOrder(db, await seedPlan(db, club));
  await signIn(page, await newStaff(db, club, { withTotp: true }));
  await page.goto(orderUrl(order));
  await expect(page.getByRole("heading", { level: 1 })).toContainText(order.reference);
  await expect(page.getByRole("link", { name: SALES.orders.detail.settle })).toHaveCount(0);
  await expect(page.getByRole("link", { name: SALES.orders.detail.cancel })).toBeVisible();
  const settle = await page.goto(`${orderUrl(order)}/settle`);
  expect(settle?.status()).toBe(404);
  await expect(page.getByRole("button", { name: SALES.orders.settle.review })).toHaveCount(0);
  expect(await db.manualPayment.count({ where: { orderId: order.orderId } })).toBe(0);
});
