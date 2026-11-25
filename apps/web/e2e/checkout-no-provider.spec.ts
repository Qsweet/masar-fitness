import { expect, test } from "@playwright/test";

/**
 * الخادم الثاني: الشراء مفتوح وبلا مزوّد دفع (`PAYMENTS_MODE=off`). لا رابط إشعار ولا صفحة دفع، وصفحة
 * الطلب كما كانت قبل المرحلة 4: الخطوة التالية واتساب، ولا زر دفع (يثبته checkout.spec.ts أيضًا).
 */
const SESSION = "fake_s_00000000-0000-7000-8000-000000000000";
const ORDER_URL = /\/checkout\/orders\/[A-Za-z0-9_-]{43}$/;

function randomMobile(): string {
  return `05${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
}

for (const provider of ["fake", "moyasar", "tabby"]) {
  test(`بلا مزوّد مضبوط ⇒ رابط الإشعار 404: ${provider}`, async ({ request }) => {
    const response = await request.post(`/api/payments/webhooks/${provider}`, {
      data: { secret: "anything", secret_token: "anything", type: "payment_paid" },
    });
    expect(response.status()).toBe(404);
  });
}

for (const prefix of ["", "/en"]) {
  test(`بلا مزوّد مضبوط ⇒ صفحة الدفع التجريبية 404 (${prefix || "/"})`, async ({ page }) => {
    const response = await page.goto(`${prefix}/checkout/demo-pay/${SESSION}`);
    expect(response?.status()).toBe(404);
  });
}

test("بلا مزوّد مضبوط: لا زر دفع، وصفحة العودة تعرض الطلب كما هو بلا أي كتابة", async ({
  page,
}) => {
  await page.goto("/checkout/three-months");
  await page.getByLabel("الاسم", { exact: true }).fill("عميل بلا دفع");
  await page.getByLabel("رقم الجوال", { exact: true }).fill(randomMobile());
  await page.getByRole("button", { name: "أكّد الطلب" }).click();
  await expect(page).toHaveURL(ORDER_URL);
  const orderPath = new URL(page.url()).pathname;
  await expect(page.getByTestId("pay-now")).toHaveCount(0);
  await expect(page.getByText("الدفع الإلكتروني غير متاح بعد", { exact: false })).toBeVisible();

  await page.goto(`${orderPath}/return?id=forged&status=paid&message=APPROVED`);
  await expect(page).toHaveURL(ORDER_URL);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("طلبك محجوز");
  await expect(page.getByText("بانتظار الدفع", { exact: true })).toBeVisible();
  await expect(page.getByTestId("pay-now")).toHaveCount(0);
});
