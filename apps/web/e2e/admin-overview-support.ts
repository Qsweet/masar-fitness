import type { Db } from "@masar/db";
import {
  createDigitalProgram,
  insertRawAttempt,
  insertRawOrder,
  setRawAttempt,
  type TestProduct,
} from "@masar/db/test-support";

/**
 * طلبات تجريبية لنادي اختبار في «نظرة عامة» (ADMIN_REDESIGN §5.1): ستون يومًا بنمط ثابت (لا عشوائية)
 * فيها مدفوع ومحاولة فاشلة ومهلة منقضية وطلب ينتظر الدفع الآن، على ثلاث باقات بأسعار CLUB_FACTS.
 */
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const DAYS = 60;
/** طلبات كل يوم بنمط أسبوعي ثابت. */
const PER_DAY = [2, 1, 2, 0, 1, 2, 2] as const;
/** المسافة بين طلبات اليوم الواحد (41 دقيقة)، والدفع بعد الإنشاء، وعمر الطلب الذي ينتظر الآن (5 دقائق). */
const SLOT_MS = 2_460_000;
const PAY_AFTER_MS = 300_000;
const AWAITING_AGE_MS = 300_000;
/** جوالات تجريبية متتالية: ‎+9665‎ ثم ثمانية أرقام. */
const PHONE_BASE = 10_000_000;
const PHONE_DIGITS = 8;
const PLANS = [
  { nameAr: "اشتراك 3 أشهر", priceMinor: 69_900 },
  { nameAr: "اشتراك 6 أشهر", priceMinor: 99_900 },
  { nameAr: "اشتراك 12 شهرًا", priceMinor: 149_900 },
] as const;
const PAID_EVERY = 4;
const FAILED_ATTEMPT =
  "status = 'failed', failure_reason = 'provider_unreachable', ended_at = deadline_at, updated_at = deadline_at";

interface SeededOrder {
  readonly createdAt: Date;
  readonly product: TestProduct;
  readonly nameAr: string;
  readonly outcome: "paid" | "failed" | "expired" | "awaiting";
}

async function insert(db: Db, clubId: string, order: SeededOrder, index: number): Promise<void> {
  const window = order.outcome === "awaiting" ? HOUR_MS : HOUR_MS / 2;
  const raw = await insertRawOrder(db, {
    clubId,
    lines: [{ product: order.product, nameAr: order.nameAr }],
    phone: `+9665${String(PHONE_BASE + index).padStart(PHONE_DIGITS, "0")}`,
    createdAt: order.createdAt,
    expiresAt: new Date(order.createdAt.getTime() + window),
  });
  if (order.outcome === "failed") {
    const attempt = await insertRawAttempt(db, {
      clubId,
      orderId: raw.orderId,
      amountMinor: order.product.priceMinor,
      createdAt: order.createdAt,
      updatedAt: order.createdAt,
      deadlineAt: new Date(order.createdAt.getTime() + window / 2),
    });
    await setRawAttempt(db, attempt.id, FAILED_ATTEMPT);
  }
  if (order.outcome === "paid") {
    await db.order.update({
      where: { id: raw.orderId },
      data: {
        status: "paid",
        paidAt: new Date(order.createdAt.getTime() + PAY_AFTER_MS),
        paidProvider: "fake",
        paidProviderPaymentId: `e2e-${raw.orderId}`,
        paidAmountMinor: order.product.priceMinor,
        paidCurrency: "SAR",
      },
    });
  }
}

function outcomeOf(index: number, day: number): SeededOrder["outcome"] {
  if (index % PAID_EVERY !== 0) {
    return "paid";
  }
  return day % 2 === 0 ? "failed" : "expired";
}

/** يملأ النادي بطلبات الأيام الستين الماضية حتى `now`، وطلب واحد ينتظر الدفع الآن. */
export async function seedSales(db: Db, clubId: string, now: Date): Promise<void> {
  const products = await Promise.all(
    PLANS.map((plan) => createDigitalProgram(db, clubId, { priceMinor: plan.priceMinor })),
  );
  let index = 0;
  for (let day = DAYS - 1; day >= 0; day -= 1) {
    const count = PER_DAY[day % PER_DAY.length] ?? 0;
    for (let slot = 0; slot < count; slot += 1) {
      const plan = (day + slot) % PLANS.length;
      const createdAt = new Date(now.getTime() - day * DAY_MS - (slot + 1) * SLOT_MS - HOUR_MS);
      const product = products[plan];
      const { nameAr } = PLANS[plan] ?? PLANS[0];
      if (product !== undefined) {
        await insert(
          db,
          clubId,
          { createdAt, product, nameAr, outcome: outcomeOf(index, day) },
          index,
        );
      }
      index += 1;
    }
  }
  const [first] = products;
  if (first !== undefined) {
    const createdAt = new Date(now.getTime() - AWAITING_AGE_MS);
    await insert(
      db,
      clubId,
      { createdAt, product: first, nameAr: PLANS[0].nameAr, outcome: "awaiting" },
      index,
    );
  }
}
