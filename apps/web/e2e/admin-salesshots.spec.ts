import type { Db } from "@masar/db";
import { applyTestSnapshot, openTestAttempt, sessionSnapshot } from "@masar/db/test-support";
import { expect, test, type Page } from "@playwright/test";
import {
  localMobile,
  orderUrl,
  SALES,
  seedLapsedOrder,
  seedPaidOrder,
  seedPendingOrder,
  seedPlan,
  type SeededOrder,
} from "./admin-sales-support";
import {
  SHOT_DESKTOP,
  SHOT_THEMES,
  shootAll,
  shootHere,
  watchProblems,
} from "./admin-shots-support";
import { newClub, newStaff, setTheme, signIn } from "./admin-support";
import { testDb } from "./payments-support";

/**
 * لقطات صفحات المبيعات (ADMIN_A2_SALES §12) بالمظهرين والمقاسات الأربعة: القائمة فارغةً ومصفّاةً،
 * والتفصيل في كل حالة، وتأكيد الإلغاء، والدفع اليدوي بخطوتيه ونجاحه، والعملاء، وكشف الجوال.
 */
const NAMES = ["عبدالله الشمري", "نورة العتيبي", "فيصل الدوسري", "ريم الغامدي", "تركي العنزي"];
const text = SALES.orders.settle;

function nameAt(index: number): string {
  return NAMES[index % NAMES.length] ?? "";
}

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

/** خطوة تأكيد الدفع: لا تصمد لإعادة التحميل، فتُبنى لكل مظهر. */
async function openConfirmStep(page: Page, order: SeededOrder, reference: string): Promise<void> {
  await page.goto(`${orderUrl(order)}/settle`);
  await page.getByLabel(text.reference).fill(reference);
  await page.getByLabel(text.amount).fill("1,499.00");
  await page.getByLabel(text.note).fill("حوالة من مصرف الراجحي، وصلت صباح اليوم.");
  await page.getByRole("button", { name: text.review, exact: true }).click();
  await expect(page.getByTestId("settle-restate")).toBeVisible();
}

test("صفحات المبيعات بالمظهرين والمقاسات الأربعة", async ({ page }) => {
  test.slow();
  const problems = watchProblems(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const club = await newClub(db);
  const plan = await seedPlan(db, club);
  const owner = await newStaff(db, club, { withTotp: true, displayName: "خالد المطيري" });
  await signIn(page, owner);

  await page.goto("/admin/sales/orders");
  await shootAll(page, "sales-orders-empty");

  const pending = await seedPendingOrder(db, plan, { name: nameAt(0) });
  const paid = await seedPaidOrder(db, plan, { name: nameAt(1) });
  const lapsed = await seedLapsedOrder(db, club, plan);
  const cancelled = await seedPendingOrder(db, plan, { name: nameAt(2) });
  const toSettle = await seedPendingOrder(db, plan, { name: nameAt(3) });
  const waiting = await seedPendingOrder(db, plan, { name: nameAt(4) });
  const failed = await openTestAttempt(db, cancelled.orderId);
  const closed = sessionSnapshot(failed, [], { state: "closed", rawStatus: "expired" });
  await applyTestSnapshot(db, failed, closed, new Date());
  await openTestAttempt(db, waiting.orderId);
  for (let index = 0; index < 4; index += 1) {
    await seedPaidOrder(db, plan, { name: nameAt(index) });
  }

  await page.goto("/admin/sales/orders");
  await shootAll(page, "sales-orders");
  await page.goto("/admin/sales/orders?tab=awaiting");
  await shootAll(page, "sales-orders-awaiting");
  await page.goto("/admin/sales/orders?tab=cancelled");
  await shootAll(page, "sales-orders-tab-empty");
  await page.goto("/admin/sales/orders?reference=MSR-9999999");
  await shootAll(page, "sales-orders-no-reference");

  for (const [name, order] of [
    ["pending", pending],
    ["paid", paid],
    ["expired", lapsed],
    ["live-attempt", waiting],
  ] as const) {
    await page.goto(orderUrl(order));
    await shootAll(page, `sales-order-${name}`);
  }

  await page.goto(`${orderUrl(cancelled)}/cancel`);
  await shootAll(page, "sales-order-cancel");
  await page.getByLabel(SALES.orders.cancel.reason).selectOption("customer_request");
  await page.getByRole("button", { name: SALES.orders.cancel.submit }).click();
  await expect(page).toHaveURL(/done=order_cancelled$/);
  await shootAll(page, "sales-order-cancelled");

  await page.goto(`${orderUrl(toSettle)}/settle`);
  await shootAll(page, "sales-settle-step1");
  await page.getByLabel(text.reference).fill("TRF-88412");
  await page.getByLabel(text.amount).fill("1400");
  await page.getByRole("button", { name: text.review, exact: true }).click();
  await expect(page.locator('form [role="alert"]')).toBeVisible();
  await shootHere(page, "sales-settle-step1-error", "dark");
  for (const theme of SHOT_THEMES) {
    await setTheme(page, theme);
    await openConfirmStep(page, toSettle, "TRF-88412");
    await shootHere(page, "sales-settle-step2", theme);
  }
  await setTheme(page, "dark");
  await openConfirmStep(page, toSettle, "TRF-88412");
  await page.getByLabel(text.confirmCheck).check();
  await page.getByRole("button", { name: text.confirm }).click();
  await expect(page).toHaveURL(/done=manual_payment_recorded$/);
  await shootAll(page, "sales-settle-success");

  await page.goto("/admin/sales/customers");
  await shootAll(page, "sales-customers");
  await page.getByLabel(SALES.customers.lookup.mobile).fill("0500000000");
  await page.getByRole("button", { name: SALES.customers.lookup.submit }).click();
  await expect(page.locator('form [role="alert"]')).toBeVisible();
  await shootHere(page, "sales-customers-not-found", "dark");
  await page.getByLabel(SALES.customers.lookup.mobile).fill(localMobile(paid.phone));
  await page.getByRole("button", { name: SALES.customers.lookup.submit }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/sales/customers/${paid.customerId}$`));
  await shootAll(page, "sales-customer");
  for (const theme of SHOT_THEMES) {
    await setTheme(page, theme);
    await page.reload();
    await page.getByRole("button", { name: SALES.customers.reveal.submit }).click();
    await expect(page.getByTestId("revealed-phone")).toBeVisible();
    await shootHere(page, "sales-customer-revealed", theme);
  }
  await setTheme(page, "dark");
  expect(problems).toEqual([]);
});
