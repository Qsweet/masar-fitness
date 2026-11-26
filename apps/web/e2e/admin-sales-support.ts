import { createOrder, markOrderPaid, type Db } from "@masar/db";
import {
  createPlan,
  insertRawOrder,
  orderInput,
  testBuyer,
  unwrap,
  type TestProduct,
} from "@masar/db/test-support";
import type { Locator, Page } from "@playwright/test";
import { TEXT, type Club } from "./admin-support";

/**
 * عدّة اختبارات المبيعات في اللوحة: باقة اختبار وطلبات حقيقية بطبقة الطلبات نفسها (لقطة وتدقيق)،
 * بأوقات «الآن» ليكون المعلّق منها داخل مهلته فعلًا. قيم اختبار لا قرارات المالك.
 */
export const SALES = TEXT.sales;
export const PLAN_PRICE = 149_900;
export const PLAN_PRICE_TEXT = "1,499";
const DECIMAL_BASE = 10;
const MOBILE_SUFFIX_DIGITS = 8;
const HOUR_MS = 3_600_000;
/** طلب أُنشئ قبل ثلاث ساعات: بلغ مهلة الثلاثين دقيقة منذ زمن. */
const LAPSED_HOURS = 3;
const LAPSED_AGE_MS = LAPSED_HOURS * HOUR_MS;
const VISIBLE_DIGITS = 4;

export function seedPlan(db: Db, club: Club): Promise<TestProduct> {
  return createPlan(db, club.id, { priceMinor: PLAN_PRICE, durationMonths: 3, bonusMonths: 1 });
}

/** جوال سعودي عشوائي بصيغته المخزَّنة. */
export function randomE164(): string {
  const suffix = Math.floor(Math.random() * DECIMAL_BASE ** MOBILE_SUFFIX_DIGITS);
  return `+9665${String(suffix).padStart(MOBILE_SUFFIX_DIGITS, "0")}`;
}

/** كما يكتبه الموظف: ‎05XXXXXXXX‎. */
export function localMobile(e164: string): string {
  return `0${e164.slice("+966".length)}`;
}

export interface SeededOrder {
  readonly orderId: string;
  readonly reference: string;
  readonly customerId: string;
  readonly phone: string;
  readonly name: string;
}

export interface OrderSeed {
  readonly name?: string;
  readonly phone?: string;
}

/** طلب معلّق داخل مهلته، عبر `createOrder` نفسها. */
export async function seedPendingOrder(
  db: Db,
  plan: TestProduct,
  seed: OrderSeed = {},
): Promise<SeededOrder> {
  const phone = seed.phone ?? randomE164();
  const name = seed.name ?? "عبدالله الشمري";
  const input = orderInput(plan.slug, PLAN_PRICE, {
    buyer: testBuyer(phone, name),
    now: new Date(),
  });
  const created = unwrap(await createOrder(db, input));
  const row = await db.order.findUniqueOrThrow({ where: { id: created.orderId } });
  return { orderId: row.id, reference: row.reference, customerId: row.customerId, phone, name };
}

/** طلب مدفوع عبر مسار التسوية نفسه (اشتراك وتسليم). */
export async function seedPaidOrder(
  db: Db,
  plan: TestProduct,
  seed: OrderSeed = {},
): Promise<SeededOrder> {
  const order = await seedPendingOrder(db, plan, seed);
  const payment = {
    provider: "test_pay",
    providerPaymentId: `e2e-${order.orderId}`,
    amountMinor: PLAN_PRICE,
    currency: "SAR",
  };
  unwrap(
    await markOrderPaid(db, {
      orderId: order.orderId,
      payment,
      actor: "provider",
      now: new Date(),
    }),
  );
  return order;
}

/** طلب معلّق أُنشئ قبل ساعات وبلغ مهلته ولم يُكتب منتهيًا. */
export async function seedLapsedOrder(db: Db, club: Club, plan: TestProduct): Promise<SeededOrder> {
  const phone = randomE164();
  const raw = await insertRawOrder(db, {
    clubId: club.id,
    lines: [{ product: plan }],
    phone,
    createdAt: new Date(Date.now() - LAPSED_AGE_MS),
  });
  const row = await db.order.findUniqueOrThrow({ where: { id: raw.orderId } });
  return {
    orderId: row.id,
    reference: row.reference,
    customerId: row.customerId,
    phone,
    name: row.customerName,
  };
}

export function orderUrl(order: SeededOrder): string {
  return `/admin/sales/orders/${order.orderId}`;
}

/** جدول الطلبات وصفوفه. */
export function orderRows(page: Page): Locator {
  return page.getByTestId("orders-table").locator("tbody tr");
}

/** رابط الطلب في الجدول باسمه لقارئ الشاشة (يعمل في صف الهاتف المضغوط والجدول الواسع). */
export function orderLink(page: Page, reference: string): Locator {
  return page.getByRole("link", { name: SALES.orders.open.replace("{reference}", reference) });
}

export function maskOf(phone: string): string {
  return `+966•••••${phone.slice(-VISIBLE_DIGITS)}`;
}
