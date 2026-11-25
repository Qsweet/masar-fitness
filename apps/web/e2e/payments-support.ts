import { createDb, type Db } from "@masar/db";
import { expect, type APIResponse, type Page } from "@playwright/test";
import { FAKE_WEBHOOK_SECRET } from "./payments-env";

/**
 * عدّة اختبارات الدفع في المتصفح: إنشاء طلب عبر الواجهة، وقراءة أثره من قاعدة الاختبار نفسها التي
 * يكتب فيها الخادم (الاشتراك مرة واحدة، والحوادث)، وإرسال إشعار بشكل مزوّد الاختبار.
 */
export const ORDER_URL = /\/checkout\/orders\/[A-Za-z0-9_-]{43}$/;
export const DEMO_URL = /\/checkout\/demo-pay\/fake_s_[0-9a-f-]{36}$/;
const WEBHOOK_PATH = "/api/payments/webhooks/fake";

export function testDb(): Db {
  const url = process.env.DATABASE_URL;
  if (url === undefined || url === "") {
    throw new Error("اختبارات الدفع تحتاج DATABASE_URL لقاعدة الاختبار التي يعمل عليها الخادم");
  }
  return createDb(url);
}

export function randomMobile(): string {
  return `05${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
}

export function randomIp(): string {
  const octet = () => String(Math.floor(Math.random() * 254) + 1);
  return `10.${octet()}.${octet()}.${octet()}`;
}

export interface PlacedOrder {
  readonly reference: string;
  readonly orderPath: string;
  readonly orderId: string;
}

/** ينشئ طلبًا معلّقًا للباقة الشهرية التجريبية (350 ر.س) ويقف على صفحة مراجعته. */
export async function placeOrder(
  page: Page,
  db: Db,
  prefix: "" | "/en" = "",
): Promise<PlacedOrder> {
  const labels =
    prefix === ""
      ? { name: "الاسم", mobile: "رقم الجوال" }
      : { name: "Name", mobile: "Mobile number" };
  await page.goto(`${prefix}/checkout/one-month`);
  await page.getByLabel(labels.name, { exact: true }).fill("عميل الدفع");
  await page.getByLabel(labels.mobile, { exact: true }).fill(randomMobile());
  // Enter إرسال ضمني حقيقي للنموذج، ويعمل وJavaScript معطَّل (فحص الثبات قبل النقر لا يعمل بلاه)
  await page.getByLabel(labels.mobile, { exact: true }).press("Enter");
  await expect(page).toHaveURL(ORDER_URL);
  const reference = (await page.getByTestId("order-reference").textContent()) ?? "";
  const order = await db.order.findUniqueOrThrow({ where: { reference } });
  return { reference, orderPath: new URL(page.url()).pathname, orderId: order.id };
}

/** يضغط «ادفع الآن» ويقف على صفحة الدفع التجريبية، ويرجع معرّف جلستها. */
export async function openDemoPay(page: Page): Promise<string> {
  await page.getByTestId("pay-now").click();
  await expect(page).toHaveURL(DEMO_URL);
  return (await page.getByTestId("demo-session").getAttribute("data-session")) ?? "";
}

/** معرّف أول دفعة على جلسة مزوّد الاختبار (حتمي من معرّف المحاولة). */
export function firstPaymentId(sessionId: string): string {
  return `${sessionId.replace("fake_s_", "fake_p_")}_1`;
}

export function sendWebhook(
  page: Page,
  sessionId: string,
  overrides: Record<string, unknown> = {},
): Promise<APIResponse> {
  return page.request.post(WEBHOOK_PATH, {
    data: {
      secret: FAKE_WEBHOOK_SECRET,
      event_id: `e2e-${sessionId}`,
      session_id: sessionId,
      payment_id: firstPaymentId(sessionId),
      ...overrides,
    },
  });
}

export interface OrderFacts {
  readonly status: string;
  readonly memberships: number;
  readonly paymentVerified: number;
  readonly attempts: readonly { status: string; settlementResult: string | null }[];
  readonly incidents: readonly string[];
}

export async function orderFacts(db: Db, orderId: string): Promise<OrderFacts> {
  const [order, memberships, paymentVerified, attempts, incidents] = await Promise.all([
    db.order.findUniqueOrThrow({ where: { id: orderId } }),
    db.membership.count({ where: { orderId } }),
    db.auditLog.count({ where: { entityId: orderId, action: "payment_verified" } }),
    db.paymentAttempt.findMany({ where: { orderId }, orderBy: { createdAt: "asc" } }),
    db.paymentIncident.findMany({ where: { orderId }, orderBy: { openedAt: "asc" } }),
  ]);
  return {
    status: order.status,
    memberships,
    paymentVerified,
    attempts: attempts.map(({ status, settlementResult }) => ({ status, settlementResult })),
    incidents: incidents.map((incident) => incident.kind),
  };
}

/**
 * يرسل نموذج الزر كما يرسله متصفح بلا JavaScript (حقوله المخفية كلها)، ولا يتبع التحويل. يرجع حالة
 * الرد. يُستعمل لمحاكاة عميل دفع عند المزوّد ولم يعد إلى الموقع.
 */
export async function submitWithoutFollowing(page: Page, buttonName: string): Promise<number> {
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: buttonName }) });
  const inputs = form.locator("input[name]");
  const fields: Record<string, string> = {};
  for (let index = 0; index < (await inputs.count()); index += 1) {
    const input = inputs.nth(index);
    const name = (await input.getAttribute("name")) ?? "";
    fields[name] = (await input.getAttribute("value")) ?? "";
  }
  const response = await page.request.post(page.url(), {
    multipart: fields,
    maxRedirects: 0,
    headers: { origin: new URL(page.url()).origin },
  });
  return response.status();
}
