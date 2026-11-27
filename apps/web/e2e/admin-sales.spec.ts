import type { Db } from "@masar/db";
import type { TestProduct } from "@masar/db/test-support";
import { expect, test } from "@playwright/test";
import {
  localMobile,
  maskOf,
  orderLink,
  orderRows,
  orderUrl,
  SALES,
  seedLapsedOrder,
  seedPaidOrder,
  seedPendingOrder,
  seedPlan,
} from "./admin-sales-support";
import { formAlert, navLinks, newClub, newStaff, signIn, TEXT, type Club } from "./admin-support";
import { testDb } from "./payments-support";

/** المبيعات في اللوحة (ADMIN_A2_SALES، WP1–WP3): الأدوار، وقائمة الطلبات وتفصيلها، والعملاء، والإلغاء. */
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

const ORDERS = "/admin/sales/orders";
const CUSTOMERS = "/admin/sales/customers";

test("المالك والمدير يريان المبيعات ويسجّلان الدفع، والمبيعات تلغي ولا تسجّل دفعًا", async ({
  page,
  browser,
}) => {
  const order = await seedPendingOrder(db, plan);
  const manager = await newStaff(db, club, { role: "manager", withTotp: true });
  await signIn(page, manager);
  expect(await navLinks(page)).toEqual([
    TEXT.nav.overview,
    TEXT.nav.orders,
    TEXT.nav.customers,
    TEXT.nav.plans,
    TEXT.nav.promotions,
    TEXT.nav.contentTexts,
    TEXT.nav.contentSlider,
    TEXT.nav.contentMedia,
    TEXT.nav.contentPublishing,
    TEXT.nav.audit,
    TEXT.nav.integrations,
    TEXT.nav.account,
  ]);
  await page.goto(orderUrl(order));
  const detail = SALES.orders.detail;
  await expect(page.getByRole("link", { name: detail.settle })).toBeVisible();
  await expect(page.getByRole("link", { name: detail.cancel })).toBeVisible();

  const context = await browser.newContext({ viewport: page.viewportSize() });
  const salesPage = await context.newPage();
  const sales = await newStaff(db, club, { role: "sales", withTotp: true });
  await signIn(salesPage, sales);
  expect(await navLinks(salesPage)).toEqual([
    TEXT.nav.overview,
    TEXT.nav.orders,
    TEXT.nav.customers,
    TEXT.nav.plans,
    TEXT.nav.promotions,
    TEXT.nav.account,
  ]);
  await salesPage.goto(orderUrl(order));
  await expect(salesPage.getByRole("link", { name: detail.cancel })).toBeVisible();
  await expect(salesPage.getByRole("link", { name: detail.settle })).toHaveCount(0);
  await expect(
    salesPage.getByRole("button", { name: SALES.customers.reveal.submit }),
  ).toBeVisible();
  const settle = await salesPage.goto(`${orderUrl(order)}/settle`);
  expect(settle?.status()).toBe(404);
  await context.close();
});

test("المحرر لا يرى شيئًا من المبيعات: لا تنقل، وكل مسار 404", async ({ page }) => {
  const order = await seedPendingOrder(db, plan);
  const editor = await newStaff(db, club, { role: "editor", withTotp: true });
  await signIn(page, editor);
  const { contentTexts, contentSlider, contentMedia, contentPublishing, account } = TEXT.nav;
  const content = [contentTexts, contentSlider, contentMedia, contentPublishing];
  expect(await navLinks(page)).toEqual([...content, account]);
  for (const path of [
    "/admin/sales",
    ORDERS,
    orderUrl(order),
    `${orderUrl(order)}/cancel`,
    `${orderUrl(order)}/settle`,
    CUSTOMERS,
    `${CUSTOMERS}/${order.customerId}`,
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(TEXT.notFound.title);
    await expect(page.locator("body")).not.toContainText(order.reference);
  }
});

test("القائمة: التبويبات بالحالة الفعلية، والمدى، والبحث بالمرجع، والحالات الفارغة", async ({
  page,
}) => {
  const owner = await newStaff(db, club, { withTotp: true });
  await signIn(page, owner);
  await page.goto(ORDERS);
  await expect(page.getByText(SALES.orders.empty.rangeTitle)).toBeVisible();

  const pending = await seedPendingOrder(db, plan);
  const paid = await seedPaidOrder(db, plan, { name: "نورة العتيبي" });
  const lapsed = await seedLapsedOrder(db, club, plan);
  await page.goto(ORDERS);
  await expect(orderRows(page)).toHaveCount(3);
  const tabs = page.getByRole("navigation", { name: SALES.orders.tabsLabel });

  await tabs.getByRole("link", { name: SALES.orders.tabs.awaiting }).click();
  await expect(page).toHaveURL(/tab=awaiting/);
  await expect(orderRows(page)).toHaveCount(1);
  await expect(orderLink(page, pending.reference)).toBeVisible();

  await tabs.getByRole("link", { name: SALES.orders.tabs.paid }).click();
  await expect(orderRows(page)).toHaveCount(1);
  await expect(orderLink(page, paid.reference)).toBeVisible();
  await expect(orderRows(page)).toContainText(SALES.statuses.order.fulfilled);

  // معلّق بلغ مهلته يُعرض منتهيًا وإن لم يُكتب
  await tabs.getByRole("link", { name: SALES.orders.tabs.expired }).click();
  await expect(orderRows(page)).toHaveCount(1);
  await expect(orderLink(page, lapsed.reference)).toBeVisible();
  await expect(orderRows(page)).toContainText(SALES.statuses.order.expired);

  await tabs.getByRole("link", { name: SALES.orders.tabs.cancelled }).click();
  await expect(page.getByText(SALES.orders.empty.tabTitle)).toBeVisible();

  await page.goto(`${ORDERS}?from=2020-01-01&to=2020-01-31`);
  await expect(page.getByText(SALES.orders.empty.rangeTitle)).toBeVisible();
  for (const from of ["2026-02-30", "0001-01-01", "9999-12-31"]) {
    const response = await page.goto(`${ORDERS}?from=${from}`);
    expect(response?.status(), from).toBe(200);
    await expect(page.getByText(SALES.orders.empty.invalidRangeTitle)).toBeVisible();
  }
  // طريقة الدفع باسمها من القاموس: لا معرّف مزوّد خامًا في القائمة ولا التفصيل
  await page.goto(`${ORDERS}?tab=paid`);
  await expect(page.locator("body")).not.toContainText("test_pay");
  await page.goto(orderUrl(paid));
  await expect(page.getByText(SALES.statuses.payment.unknownProvider).first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText("test_pay");
  await page.goto(ORDERS);

  const reference = page.getByLabel(SALES.orders.filters.reference);
  await reference.fill("MSR-9999999");
  await reference.press("Enter");
  await expect(page.getByText(SALES.orders.empty.referenceTitle)).toBeVisible();
  await page.getByLabel(SALES.orders.filters.reference).fill("ليس مرجعًا");
  await page.getByRole("button", { name: SALES.orders.filters.apply }).click();
  await expect(page.getByText(SALES.orders.empty.invalidReferenceTitle)).toBeVisible();

  // الأرقام وحدها تكفي، ونتيجة واحدة تفتح التفصيل مباشرة
  await page
    .getByLabel(SALES.orders.filters.reference)
    .fill(String(Number(paid.reference.slice(4))));
  await page.getByRole("button", { name: SALES.orders.filters.apply }).click();
  await expect(page).toHaveURL(new RegExp(`${orderUrl(paid)}$`));
});

test("التفصيل من اللقطة: البيانات والسطور والمجاميع والاشتراك والخط الزمني، والجوال مقنَّع", async ({
  page,
}) => {
  const paid = await seedPaidOrder(db, plan, { name: "نورة العتيبي" });
  const owner = await newStaff(db, club, { withTotp: true });
  await signIn(page, owner);
  await page.goto(ORDERS);
  await orderLink(page, paid.reference).click();
  await expect(page).toHaveURL(new RegExp(`${orderUrl(paid)}$`));
  const detail = SALES.orders.detail;
  await expect(page.getByRole("heading", { level: 1 })).toContainText(paid.reference);
  await expect(page.getByText("نورة العتيبي")).toBeVisible();
  await expect(page.getByTestId("masked-phone")).toHaveText(maskOf(paid.phone));
  await expect(page.getByTestId("order-items")).toContainText("منتج اختبار");
  await expect(page.getByTestId("order-items")).toContainText(SALES.statuses.startRule.on_payment);
  await expect(page.getByTestId("order-totals")).toContainText("1,499");
  await expect(page.getByTestId("order-totals")).toContainText("15%");
  await expect(page.getByRole("heading", { name: detail.membership })).toBeVisible();
  await expect(page.getByText(SALES.statuses.membership.active)).toBeVisible();
  const timeline = page.getByTestId("order-timeline");
  await expect(timeline).toContainText(TEXT.audit.salesActions.order_created);
  await expect(timeline).toContainText(TEXT.audit.salesActions.payment_verified);
  await expect(timeline).toContainText(TEXT.audit.salesActions.membership_created);
  // مدفوع: لا إلغاء ولا دفع يدوي
  await expect(page.getByRole("link", { name: detail.cancel })).toHaveCount(0);
  await expect(page.getByRole("link", { name: detail.settle })).toHaveCount(0);
  // الجوال الكامل ليس في حمولة الصفحة بأي صيغة
  const html = await page.content();
  expect(html).not.toContain(paid.phone);
  expect(html).not.toContain(paid.phone.slice(4));
  // طلب نادٍ آخر لا يُفتح
  const foreign = await seedPendingOrder(db, await seedPlan(db, await newClub(db)));
  const response = await page.goto(orderUrl(foreign));
  expect(response?.status()).toBe(404);
});

test("موظف المبيعات يلغي معلّقًا بتأكيد وسبب، والخط الزمني يذكره باسمه", async ({ page }) => {
  const order = await seedPendingOrder(db, plan);
  const sales = await newStaff(db, club, {
    role: "sales",
    withTotp: true,
    displayName: "سارة الحربي",
  });
  await signIn(page, sales);
  await page.goto(orderUrl(order));
  const text = SALES.orders.cancel;
  await page.getByRole("link", { name: SALES.orders.detail.cancel }).click();
  await expect(page).toHaveURL(/\/cancel$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(text.title);
  for (const consequence of text.consequences) {
    await expect(page.getByText(consequence)).toBeVisible();
  }
  await page.getByLabel(text.reason).selectOption("duplicate_order");
  await page.getByRole("button", { name: text.submit }).click();

  await expect(page).toHaveURL(new RegExp(`${orderUrl(order)}\\?done=order_cancelled$`));
  await expect(page.getByText(TEXT.notices.order_cancelled)).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(order.reference);
  const timeline = page.getByTestId("order-timeline");
  await expect(timeline).toContainText(TEXT.audit.salesActions.order_cancelled);
  await expect(timeline).toContainText("سارة الحربي");
  await expect(timeline).toContainText(text.reasons.duplicate_order);
  await expect(page.getByRole("link", { name: SALES.orders.detail.cancel })).toHaveCount(0);

  expect((await db.order.findUniqueOrThrow({ where: { id: order.orderId } })).status).toBe(
    "cancelled",
  );
  const audits = await db.auditLog.findMany({
    where: { entityId: order.orderId, action: "order_cancelled" },
  });
  expect(audits).toHaveLength(1);
  expect(audits[0]).toMatchObject({
    actor: `staff:${sales.id}`,
    data: { reason: "duplicate_order" },
  });

  await page.goto(`${ORDERS}?tab=cancelled`);
  await expect(orderLink(page, order.reference)).toBeVisible();
  // صفحة الإلغاء لطلب ملغى لا تعرض نموذجًا
  await page.goto(`${orderUrl(order)}/cancel`);
  await expect(page.getByText(text.unavailable)).toBeVisible();
  await expect(page.getByRole("button", { name: text.submit })).toHaveCount(0);
});

test("العملاء: بحث بالجوال الكامل ← صفحة العميل ← كشف مدقَّق، والرقم ليس في رابط ولا صفحة قبله", async ({
  page,
  browser,
}) => {
  const order = await seedPaidOrder(db, plan);
  const sales = await newStaff(db, club, {
    role: "sales",
    withTotp: true,
    displayName: "فهد القحطاني",
  });
  await signIn(page, sales);
  await page.goto(CUSTOMERS);
  const lookup = SALES.customers.lookup;
  await expect(page.getByText(lookup.emptyTitle)).toBeVisible();
  const mobile = page.getByLabel(lookup.mobile);

  // جزء من الرقم أو آخر أرقامه لا يطابق
  await mobile.fill(order.phone.slice(-4));
  await page.getByRole("button", { name: lookup.submit }).click();
  await expect(formAlert(page)).toHaveText(TEXT.errors["customers.mobile_invalid"]);
  await page.getByLabel(lookup.mobile).fill("0500000000");
  await page.getByRole("button", { name: lookup.submit }).click();
  await expect(formAlert(page)).toHaveText(TEXT.errors["customer.not_found"]);

  await page.getByLabel(lookup.mobile).fill(localMobile(order.phone));
  await page.getByRole("button", { name: lookup.submit }).click();
  await expect(page).toHaveURL(new RegExp(`${CUSTOMERS}/${order.customerId}$`));
  expect(page.url()).not.toContain(order.phone.slice(-8));

  await expect(page.getByTestId("masked-phone")).toHaveText(maskOf(order.phone));
  await expect(orderLink(page, order.reference)).toBeVisible();
  await expect(page.getByTestId("customer-memberships")).toContainText(
    SALES.statuses.membership.active,
  );
  expect(await page.content()).not.toContain(order.phone.slice(4));
  expect(
    await db.auditLog.count({ where: { entityId: order.customerId, action: "phone_revealed" } }),
  ).toBe(0);

  await page.getByRole("button", { name: SALES.customers.reveal.submit }).click();
  await expect(page.getByTestId("revealed-phone")).toHaveText(order.phone);
  expect(page.url()).not.toContain(order.phone.slice(-8));
  const reveals = await db.auditLog.findMany({
    where: { entityId: order.customerId, action: "phone_revealed" },
  });
  expect(reveals).toHaveLength(1);
  expect(reveals[0]).toMatchObject({ actor: `staff:${sales.id}`, data: { source: "customer" } });
  expect(JSON.stringify(reveals)).not.toContain(order.phone.slice(4));

  // السطر يظهر في سجل التدقيق باسم الموظف، وبلا الرقم
  const context = await browser.newContext({ viewport: page.viewportSize() });
  const ownerPage = await context.newPage();
  await signIn(ownerPage, await newStaff(db, club, { withTotp: true }));
  await ownerPage.goto("/admin/audit?entity=customer");
  const table = ownerPage.getByTestId("audit-table");
  await expect(table).toContainText(TEXT.audit.salesActions.phone_revealed);
  await expect(table).toContainText("فهد القحطاني");
  await expect(table).toContainText(TEXT.audit.sources.customer);
  expect(await ownerPage.content()).not.toContain(order.phone.slice(4));
  await context.close();
});

test("كشف الجوال من تفصيل الطلب يكتب سطرًا بمصدره ومعرّف الطلب", async ({ page }) => {
  const order = await seedPendingOrder(db, plan);
  const manager = await newStaff(db, club, { role: "manager", withTotp: true });
  await signIn(page, manager);
  await page.goto(orderUrl(order));
  await expect(page.getByTestId("revealed-phone")).toHaveCount(0);
  await page.getByRole("button", { name: SALES.customers.reveal.submit }).click();
  await expect(page.getByTestId("revealed-phone")).toHaveText(order.phone);
  await expect(page).toHaveURL(new RegExp(`${orderUrl(order)}$`));
  const reveals = await db.auditLog.findMany({ where: { action: "phone_revealed" } });
  expect(reveals.filter((row) => row.entityId === order.customerId)).toHaveLength(1);
  expect(reveals.find((row) => row.entityId === order.customerId)?.data).toEqual({
    source: "order",
    orderId: order.orderId,
  });
});
