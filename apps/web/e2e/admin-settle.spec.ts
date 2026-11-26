import type { Db } from "@masar/db";
import type { TestProduct } from "@masar/db/test-support";
import { expect, test, type Page } from "@playwright/test";
import {
  orderUrl,
  PLAN_PRICE,
  PLAN_PRICE_TEXT,
  SALES,
  seedLapsedOrder,
  seedPendingOrder,
  seedPlan,
  type SeededOrder,
} from "./admin-sales-support";
import { formAlert, newClub, newStaff, signIn, TEXT, type Club } from "./admin-support";
import { testDb } from "./payments-support";

/** الدفع اليدوي من اللوحة (ADMIN_A2_SALES §6.5، WP4): الخطوتان، وما يُرفض، ومن يملكه. */
let db: Db;
let club: Club;
let plan: TestProduct;

test.beforeAll(() => {
  db = testDb();
});

test.afterAll(async () => {
  await db.$disconnect();
});

test.beforeEach(async () => {
  club = await newClub(db);
  plan = await seedPlan(db, club);
});

const text = SALES.orders.settle;

async function fillStepOne(page: Page, amount: string, reference: string): Promise<void> {
  await page.getByLabel(text.method).selectOption("bank_transfer");
  await page.getByLabel(text.reference).fill(reference);
  await page.getByLabel(text.amount).fill(amount);
  await page.getByLabel(text.note).fill("وصلت الحوالة صباحًا");
  await page.getByRole("button", { name: text.review, exact: true }).click();
}

async function expectSettled(order: SeededOrder, reference: string, staffId: string) {
  const row = await db.order.findUniqueOrThrow({ where: { id: order.orderId } });
  expect(row).toMatchObject({
    status: "fulfilled",
    paidProvider: "manual",
    paidAmountMinor: PLAN_PRICE,
  });
  expect(await db.membership.count({ where: { orderId: order.orderId } })).toBe(1);
  const manual = await db.manualPayment.findMany({ where: { orderId: order.orderId } });
  expect(manual).toHaveLength(1);
  expect(manual[0]).toMatchObject({
    id: row.paidProviderPaymentId,
    method: "bank_transfer",
    externalReference: reference,
    recordedBy: staffId,
  });
}

test("المدير يسجّل دفعًا يدويًا بخطوتين: مبلغ لا يطابق يُرفض، وإعادة العرض تذكر ما سيُسجَّل", async ({
  page,
}) => {
  const order = await seedPendingOrder(db, plan, { name: "عبدالله الشمري" });
  const manager = await newStaff(db, club, {
    role: "manager",
    withTotp: true,
    displayName: "خالد المطيري",
  });
  await signIn(page, manager);
  await page.goto(orderUrl(order));
  await page.getByRole("link", { name: SALES.orders.detail.settle }).click();
  await expect(page).toHaveURL(/\/settle$/);
  await expect(page.getByText(text.warning)).toBeVisible();
  await expect(page.getByText(text.stepOne)).toBeVisible();

  // مبلغ جزئي: يبقى في الخطوة الأولى بما كُتب، ولا شيء يُكتب
  await fillStepOne(page, "1400", "TRF-88412");
  await expect(formAlert(page)).toHaveText(TEXT.errors["payment.amount_mismatch"]);
  await expect(page.getByLabel(text.reference)).toHaveValue("TRF-88412");
  await expect(page.getByLabel(text.amount)).toHaveValue("1400");
  expect(await db.manualPayment.count({ where: { orderId: order.orderId } })).toBe(0);

  await fillStepOne(page, "1,499.00", "TRF-88412");
  await expect(page.getByText(text.stepTwo)).toBeVisible();
  const restate = page.getByTestId("settle-restate");
  for (const part of [`${PLAN_PRICE_TEXT} ر.س`, order.reference, "TRF-88412", "عبدالله الشمري"]) {
    await expect(restate).toContainText(part);
  }
  await expect(restate).toContainText("يفعّل الاشتراك فورًا");
  await expect(page.getByText(SALES.statuses.manualMethod.bank_transfer)).toBeVisible();
  expect(await db.manualPayment.count({ where: { orderId: order.orderId } })).toBe(0);

  // «عدّل» يعود إلى الحقول بما كُتب
  await page.getByRole("button", { name: text.edit }).click();
  await expect(page.getByLabel(text.amount)).toHaveValue("1,499.00");
  await page.getByRole("button", { name: text.review, exact: true }).click();
  await expect(page.getByText(text.stepTwo)).toBeVisible();

  // بلا مربع التأكيد لا يُرسل النموذج
  await page.getByRole("button", { name: text.confirm }).click();
  await expect(page).toHaveURL(/\/settle$/);
  expect((await db.order.findUniqueOrThrow({ where: { id: order.orderId } })).status).toBe(
    "pending_payment",
  );
  await page.getByLabel(text.confirmCheck).check();
  await page.getByRole("button", { name: text.confirm }).click();

  await expect(page).toHaveURL(new RegExp(`${orderUrl(order)}\\?done=manual_payment_recorded$`));
  await expect(page.getByText(TEXT.notices.manual_payment_recorded)).toBeVisible();
  await expect(page.getByText(SALES.statuses.manualProvider).first()).toBeVisible();
  await expect(page.getByText("TRF-88412").first()).toBeVisible();
  await expect(page.getByText("وصلت الحوالة صباحًا")).toBeVisible();
  const timeline = page.getByTestId("order-timeline");
  await expect(timeline).toContainText(TEXT.audit.salesActions.manual_payment_recorded);
  await expect(timeline).toContainText("خالد المطيري");
  await expect(page.getByRole("link", { name: SALES.orders.detail.settle })).toHaveCount(0);
  await expectSettled(order, "TRF-88412", manager.id);
  const audit = await db.auditLog.findMany({ where: { action: "manual_payment_recorded" } });
  expect(JSON.stringify(audit)).not.toContain("وصلت الحوالة");
});

test("المرجع الخارجي لا يسوّي طلبين، والطلب المدفوع لا يُدفع ثانية", async ({ page }) => {
  const first = await seedPendingOrder(db, plan);
  const second = await seedPendingOrder(db, plan, { name: "فيصل الدوسري" });
  const owner = await newStaff(db, club, { withTotp: true });
  await signIn(page, owner);
  await page.goto(`${orderUrl(first)}/settle`);
  await fillStepOne(page, "1499", "RCPT-2026-17");
  await page.getByLabel(text.confirmCheck).check();
  await page.getByRole("button", { name: text.confirm }).click();
  await expect(page).toHaveURL(/done=manual_payment_recorded$/);

  await page.goto(`${orderUrl(second)}/settle`);
  await fillStepOne(page, "1499", "RCPT-2026-17");
  await page.getByLabel(text.confirmCheck).check();
  await page.getByRole("button", { name: text.confirm }).click();
  await expect(formAlert(page)).toHaveText(TEXT.errors["manual_payment.reference_used"]);
  expect((await db.order.findUniqueOrThrow({ where: { id: second.orderId } })).status).toBe(
    "pending_payment",
  );
  // صفحة الدفع لطلب مدفوع لا تعرض نموذجًا
  await page.goto(`${orderUrl(first)}/settle`);
  await expect(page.getByText(text.unavailable)).toBeVisible();
  await expect(page.getByRole("button", { name: text.review, exact: true })).toHaveCount(0);
});

test("طلب بلغ مهلته لا يُدفع: لا زر، والصفحة تقول ذلك", async ({ page }) => {
  const lapsed = await seedLapsedOrder(db, club, plan);
  await signIn(page, await newStaff(db, club, { withTotp: true }));
  await page.goto(orderUrl(lapsed));
  await expect(page.getByRole("link", { name: SALES.orders.detail.settle })).toHaveCount(0);
  await expect(page.getByRole("link", { name: SALES.orders.detail.cancel })).toHaveCount(0);
  await page.goto(`${orderUrl(lapsed)}/settle`);
  await expect(page.getByText(text.unavailable)).toBeVisible();
});

test("الدفع اليدوي يعمل بلا JavaScript: الخطوتان من الخادم", async ({ browser, page }) => {
  const order = await seedPendingOrder(db, plan);
  const owner = await newStaff(db, club, { withTotp: true });
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: page.viewportSize(),
  });
  const plain = await context.newPage();
  await signIn(plain, owner);
  await plain.goto(`${orderUrl(order)}/settle`);
  await plain.getByLabel(text.reference).fill("NOJS-7001");
  await plain.getByLabel(text.amount).fill("١٤٩٩");
  await plain.getByRole("button", { name: text.review, exact: true }).click();
  await expect(plain.getByTestId("settle-restate")).toContainText("NOJS-7001");
  await plain.getByLabel(text.confirmCheck).check();
  await plain.getByRole("button", { name: text.confirm }).click();
  await expect(plain).toHaveURL(/done=manual_payment_recorded$/);
  await expectSettled(order, "NOJS-7001", owner.id);
  await context.close();
});
