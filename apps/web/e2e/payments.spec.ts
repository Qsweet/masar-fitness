import { forceExpireOrder } from "@masar/db/test-support";
import { expect, test } from "@playwright/test";
import type { Db } from "@masar/db";
import {
  DEMO_URL,
  ORDER_URL,
  firstPaymentId,
  openDemoPay,
  orderFacts,
  placeOrder,
  randomIp,
  sendWebhook,
  submitWithoutFollowing,
  testDb,
} from "./payments-support";

/**
 * مسار الدفع كاملًا على الخادم الثالث (العلم مفتوح ومزوّد الاختبار): ادفع ← صفحة المزوّد التجريبية ←
 * العودة ← التحقق الخادمي. لا شبكة خارجية ولا مال. الأثر يُقرأ من قاعدة الاختبار نفسها.
 */
let db: Db;

test.beforeAll(() => {
  db = testDb();
});

test.afterAll(async () => {
  await db.$disconnect();
});

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": randomIp() });
});

test("دفع ناجح: مدفوع بعد العودة، واشتراك واحد ولو تكررت العودة", async ({ page }) => {
  const order = await placeOrder(page, db);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("طلبك محجوز");
  await expect(page.getByText("وضع تجريبي: الدفع هنا محاكاة")).toBeVisible();
  await expect(page.getByText("الدفع الإلكتروني غير متاح بعد", { exact: false })).toHaveCount(0);

  await openDemoPay(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("صفحة دفع تجريبية");
  await expect(page.getByText(order.reference)).toBeVisible();
  await expect(page.getByTestId("demo-amount")).toContainText("350 ر.س");
  // قبل اختيار النتيجة: محاولة pending ولا شيء مدفوع
  expect(await orderFacts(db, order.orderId)).toMatchObject({
    status: "pending_payment",
    memberships: 0,
    attempts: [{ status: "pending", settlementResult: null }],
  });

  await page.getByRole("button", { name: "دفع ناجح" }).click();
  await expect(page).toHaveURL(ORDER_URL);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("تم دفع طلبك");
  await expect(page.getByTestId("pay-now")).toHaveCount(0);
  expect(await orderFacts(db, order.orderId)).toEqual({
    status: "fulfilled",
    memberships: 1,
    paymentVerified: 1,
    attempts: [{ status: "captured", settlementResult: "paid" }],
    incidents: [],
  });

  // العودة مرة ثانية وثالثة (تحديث الصفحة أو رابط محفوظ) لا تفعّل شيئًا جديدًا
  for (let visit = 0; visit < 2; visit += 1) {
    await page.goto(`${order.orderPath}/return?id=forged&status=paid&message=APPROVED`);
    await expect(page).toHaveURL(ORDER_URL);
  }
  expect(await orderFacts(db, order.orderId)).toMatchObject({ memberships: 1, paymentVerified: 1 });
});

test("العودة برابط يدّعي الدفع لا تفعّل شيئًا: الحالة من المزوّد لا من الرابط", async ({
  page,
}) => {
  const order = await placeOrder(page, db);
  await openDemoPay(page);
  await page.goto(`${order.orderPath}/return?id=anything&status=paid&message=APPROVED`);
  await expect(page).toHaveURL(ORDER_URL);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("طلبك محجوز");
  await expect(page.getByRole("button", { name: "أكمل الدفع" })).toBeVisible();
  expect(await orderFacts(db, order.orderId)).toMatchObject({
    status: "pending_payment",
    memberships: 0,
    attempts: [{ status: "pending" }],
  });
});

test("إشعار لمرجع لا نعرفه: 200 بلا أثر (نظام آخر على الحساب نفسه)", async ({ page }) => {
  const unknown = "fake_s_00000000-0000-7000-8000-000000000000";
  const before = await db.paymentIncident.count();
  expect((await sendWebhook(page, unknown)).status()).toBe(200);
  expect(await db.paymentIncident.count()).toBe(before);
});

test("صفحة الدفع التجريبية 404 لطلب لا يصل على عنوان الجهاز نفسه", async ({ page }) => {
  await placeOrder(page, db);
  await openDemoPay(page);
  const demoPath = new URL(page.url()).pathname;
  const local = await page.request.get(demoPath);
  expect(local.status()).toBe(200);
  const proxied = await page.request.get(demoPath, { headers: { host: "preview.example.com" } });
  expect(proxied.status()).toBe(404);
});

test("مبلغ لا يطابق: حادثة للإدارة، والطلب لا يُفعَّل ولا يُعرض زر دفع", async ({ page }) => {
  const order = await placeOrder(page, db);
  await openDemoPay(page);
  await page.getByRole("button", { name: "دفع بمبلغ مختلف" }).click();
  await expect(page).toHaveURL(ORDER_URL);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("دفعتك قيد المراجعة");
  await expect(page.getByText("قيد المراجعة", { exact: true })).toBeVisible();
  await expect(page.getByTestId("pay-now")).toHaveCount(0);
  const whatsapp = page.getByRole("link", { name: "أرسل رقم الطلب عبر واتساب" });
  expect(decodeURIComponent((await whatsapp.getAttribute("href")) ?? "")).toContain(
    order.reference,
  );
  expect(await orderFacts(db, order.orderId)).toEqual({
    status: "pending_payment",
    memberships: 0,
    paymentVerified: 0,
    attempts: [{ status: "captured", settlementResult: "payment.amount_mismatch" }],
    incidents: ["amount_mismatch"],
  });
  const rejected = await db.auditLog.count({
    where: { entityId: order.orderId, action: "payment_rejected" },
  });
  expect(rejected).toBe(1);
});

test("دفعة متأخرة على طلب منتهٍ: غير قابل للدفع وحادثة، بلا اشتراك", async ({ page }) => {
  const order = await placeOrder(page, db);
  await openDemoPay(page);
  // ما يمنعه الطريق العادي (الطلب لا يُنهى ومحاولته حيّة) يُحاكى بتجاوز السدّ في قاعدة الاختبار
  await forceExpireOrder(db, order.orderId);
  await page.getByRole("button", { name: "دفع ناجح" }).click();
  await expect(page).toHaveURL(ORDER_URL);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("دفعتك قيد المراجعة");
  await expect(page.getByTestId("pay-now")).toHaveCount(0);
  expect(await orderFacts(db, order.orderId)).toEqual({
    status: "expired",
    memberships: 0,
    paymentVerified: 0,
    attempts: [{ status: "captured", settlementResult: "order.not_payable" }],
    incidents: ["late_payment_not_payable"],
  });
});

test("دفع فاشل ثم رجوع بلا دفع: الطلب معلّق والجلسة نفسها تُستكمل", async ({ page }) => {
  const order = await placeOrder(page, db);
  const sessionId = await openDemoPay(page);
  await page.getByRole("button", { name: "دفع فاشل" }).click();
  await expect(page).toHaveURL(ORDER_URL);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("طلبك محجوز");
  await page.getByRole("button", { name: "أكمل الدفع" }).click();
  await expect(page).toHaveURL(DEMO_URL);
  expect(await page.getByTestId("demo-session").getAttribute("data-session")).toBe(sessionId);
  await page.getByRole("link", { name: "رجوع بلا دفع" }).click();
  await expect(page).toHaveURL(ORDER_URL);
  await page.getByRole("link", { name: "حدّث حالة الدفع" }).click();
  await expect(page).toHaveURL(ORDER_URL);
  expect(await orderFacts(db, order.orderId)).toMatchObject({
    status: "pending_payment",
    memberships: 0,
    attempts: [{ status: "pending", settlementResult: null }],
    incidents: [],
  });
});

test("دفع يبقى معلّقًا: «أكمل الدفع» وتحديث الحالة، ولا تفعيل", async ({ page }) => {
  const order = await placeOrder(page, db);
  await openDemoPay(page);
  await page.getByRole("button", { name: "دفع يبقى معلّقًا" }).click();
  await expect(page).toHaveURL(ORDER_URL);
  await expect(page.getByRole("link", { name: "حدّث حالة الدفع" })).toBeVisible();
  expect(await orderFacts(db, order.orderId)).toMatchObject({
    status: "pending_payment",
    memberships: 0,
  });
});

test("ضغطتان على «ادفع الآن»: محاولة واحدة وجلسة واحدة", async ({ page }) => {
  const order = await placeOrder(page, db);
  await page.getByTestId("pay-now").dblclick();
  await expect(page).toHaveURL(DEMO_URL);
  const first = new URL(page.url()).pathname;
  await page.goto(order.orderPath);
  await page.getByTestId("pay-now").click();
  await expect(page).toHaveURL(DEMO_URL);
  expect(new URL(page.url()).pathname).toBe(first);
  expect((await orderFacts(db, order.orderId)).attempts).toEqual([
    { status: "pending", settlementResult: null },
  ]);
});

test("بالإنجليزية: صفحة الدفع التجريبية والعودة بلغة العميل", async ({ page }) => {
  const order = await placeOrder(page, db, "/en");
  await expect(page.getByText("Demo mode: payment here is a simulation")).toBeVisible();
  await page.getByRole("button", { name: "Pay now" }).click();
  await expect(page).toHaveURL(/\/en\/checkout\/demo-pay\/fake_s_/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Demo payment page");
  await expect(page.getByTestId("demo-amount")).toContainText("350 SAR");
  await page.getByRole("button", { name: "Successful payment" }).click();
  await expect(page).toHaveURL(/\/en\/checkout\/orders\/[A-Za-z0-9_-]{43}$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your order is paid");
  expect(await orderFacts(db, order.orderId)).toMatchObject({
    status: "fulfilled",
    memberships: 1,
  });
});

test.describe("الدفع وJavaScript معطَّل", () => {
  test.use({ javaScriptEnabled: false });

  test("الإشعار: السر المزوّر مرفوض، والصحيح يفعّل مرة واحدة مهما تكرر", async ({ page }) => {
    const order = await placeOrder(page, db);
    await page.getByTestId("pay-now").press("Enter");
    await expect(page).toHaveURL(DEMO_URL);
    const sessionId = (await page.getByTestId("demo-session").getAttribute("data-session")) ?? "";
    // العميل دفع عند المزوّد ولم يعد إلى الموقع: يُرسل نموذج النتيجة ولا يُتبع تحويله إلى صفحة
    // العودة، فيبقى الإشعار الطريق الوحيد إلى التحقق
    expect(await submitWithoutFollowing(page, "دفع ناجح")).toBe(303);
    expect((await orderFacts(db, order.orderId)).attempts).toEqual([
      { status: "pending", settlementResult: null },
    ]);

    for (const forged of [{ secret: "forged-secret" }, { secret: "" }, { secret: undefined }]) {
      expect((await sendWebhook(page, sessionId, forged)).status()).toBe(401);
    }
    expect(
      (await page.request.post("/api/payments/webhooks/fake", { data: "{not json" })).status(),
    ).toBe(400);
    expect((await page.request.post("/api/payments/webhooks/moyasar", { data: {} })).status()).toBe(
      404,
    );
    expect(await orderFacts(db, order.orderId)).toMatchObject({
      status: "pending_payment",
      memberships: 0,
    });

    expect((await sendWebhook(page, sessionId)).status()).toBe(200);
    await expect
      .poll(() => orderFacts(db, order.orderId).then((facts) => facts.status))
      .toBe("fulfilled");

    // المزوّد يعيد الإشعار نفسه (وبجسم مختلف): ردود 200 بلا أثر ثانٍ
    const replays = await Promise.all([
      sendWebhook(page, sessionId),
      sendWebhook(page, sessionId),
      sendWebhook(page, sessionId, { session_id: undefined }),
      sendWebhook(page, sessionId, { payment_id: firstPaymentId(sessionId), status: "refunded" }),
    ]);
    expect(replays.map((response) => response.status())).toEqual([200, 200, 200, 200]);
    await page.goto(order.orderPath);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("تم دفع طلبك");
    expect(await orderFacts(db, order.orderId)).toEqual({
      status: "fulfilled",
      memberships: 1,
      paymentVerified: 1,
      attempts: [{ status: "captured", settlementResult: "paid" }],
      incidents: [],
    });
  });

  test("زر الدفع ونتائج المحاكاة نماذج HTML عادية", async ({ page }) => {
    const order = await placeOrder(page, db);
    await page.getByTestId("pay-now").press("Enter");
    await expect(page).toHaveURL(DEMO_URL);
    await page.getByRole("button", { name: "دفع ناجح" }).press("Enter");
    await expect(page).toHaveURL(ORDER_URL);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("تم دفع طلبك");
    expect(await orderFacts(db, order.orderId)).toMatchObject({
      status: "fulfilled",
      memberships: 1,
    });
  });
});
