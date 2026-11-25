import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  applyProviderSnapshot,
  createDb,
  createOrder,
  createPaymentAttempt,
  expireAllDueOrders,
  expireDueOrders,
  markSessionOpened,
  type Db,
  type PaymentAttemptRecord,
} from "./index";
import {
  createPlan,
  createTestClub,
  TEST_NOW,
  TEST_PAYMENT_WINDOW_MINUTES,
  type TestProduct,
} from "./test-support/commerce-fixtures";
import {
  createDbClients,
  disconnectAll,
  failure,
  orderInput,
  testBuyer,
  testDatabaseUrl,
  testPhone,
  unwrap,
} from "./test-support/commerce-orders";
import {
  paymentSnapshot,
  sessionSnapshot,
  TEST_MIN_PAYMENT_MINUTES,
  TEST_PROVIDER,
  TEST_STUCK_AFTER_MS,
  testPaymentId,
  testSessionId,
} from "./test-support/payments-fixtures";
import { resetCommerceTables } from "./test-support/reset-database";

const PLAN_PRICE = 90_000;
const MINUTE_MS = 60_000;
const RACE_ROUNDS = 150;
const RACE_TIMEOUT_MS = 120_000;
/** بعد المهلة بدقيقة: الإنهاء ممكن، وبدء الدفع بساعة العميل (TEST_NOW) ممكن أيضًا: يتسابقان. */
const AFTER_DEADLINE = new Date(TEST_NOW.getTime() + (TEST_PAYMENT_WINDOW_MINUTES + 1) * MINUTE_MS);

let db: Db;
let other: Db;
let plan: TestProduct;
let phoneIndex = 0;

beforeAll(async () => {
  db = createDb(testDatabaseUrl());
  [other] = createDbClients(1) as [Db];
  await resetCommerceTables(db);
  const clubId = await createTestClub(db);
  plan = await createPlan(db, clubId, { priceMinor: PLAN_PRICE, durationMonths: 1 });
});

beforeEach(async () => {
  await db.$executeRaw`
    TRUNCATE audit_logs, memberships, order_discounts, order_items, orders, customers CASCADE`;
});

afterAll(async () => {
  await resetCommerceTables(db);
  await disconnectAll([other]);
  await db.$disconnect();
});

async function newOrder(): Promise<string> {
  phoneIndex += 1;
  const input = orderInput(plan.slug, PLAN_PRICE, { buyer: testBuyer(testPhone(phoneIndex)) });
  return unwrap(await createOrder(db, input)).orderId;
}

function start(orderId: string, client = db) {
  return createPaymentAttempt(client, {
    orderId,
    provider: TEST_PROVIDER,
    providerMode: "test",
    minPaymentMinutes: TEST_MIN_PAYMENT_MINUTES,
    now: TEST_NOW,
  });
}

async function open(attempt: PaymentAttemptRecord): Promise<PaymentAttemptRecord> {
  return unwrap(
    await markSessionOpened(db, {
      attemptId: attempt.id,
      providerSessionId: testSessionId(attempt.id),
      providerStatus: "open",
      now: TEST_NOW,
    }),
  );
}

function expire(client: Db = db, limit = 10) {
  return expireDueOrders(client, { now: AFTER_DEADLINE, limit });
}

function statusOf(orderId: string) {
  return db.order.findUniqueOrThrow({ where: { id: orderId } }).then((order) => order.status);
}

function apply(attempt: PaymentAttemptRecord, state: "open" | "closed", paid = false) {
  const payments = paid ? [paymentSnapshot(attempt, "paid", { amountMinor: PLAN_PRICE - 1 })] : [];
  return applyProviderSnapshot(db, {
    attemptId: attempt.id,
    snapshot: sessionSnapshot(attempt, payments, { state }),
    now: AFTER_DEADLINE,
    stuckAlertAfterMs: TEST_STUCK_AFTER_MS,
  }).then(unwrap);
}

describe("expireDueOrders والمحاولة الحيّة (الشرط الصلب 2)", () => {
  it("يتخطى الطلب ذا المحاولة created ثم pending، وينهيه بعد أن تصير نهائية", async () => {
    const orderId = await newOrder();
    const { attempt } = unwrap(await start(orderId));
    expect(await expire()).toBe(0);
    const pending = await open(attempt);
    expect(await expire()).toBe(0);
    expect(await statusOf(orderId)).toBe("pending_payment");
    await apply(pending, "closed");
    expect(await expire()).toBe(1);
    expect(await statusOf(orderId)).toBe("expired");
  });

  it("يتخطى authorized، وcaptured ما لم تُسجَّل تسويتها", async () => {
    const authorized = await open(unwrap(await start(await newOrder())).attempt);
    await db.paymentAttempt.update({
      where: { id: authorized.id },
      data: { status: "authorized", authorizedAt: TEST_NOW },
    });
    const captured = await open(unwrap(await start(await newOrder())).attempt);
    await db.paymentAttempt.update({
      where: { id: captured.id },
      data: { status: "captured", providerPaymentId: testPaymentId(captured.id) },
    });
    expect(await expire()).toBe(0);
    // تسوية مرفوضة (مبلغ لا يطابق) تُنهي حياة المحاولة: الطلب يعود قابلًا للإنهاء
    await apply(captured, "open", true);
    expect(await expire()).toBe(1);
    expect(await statusOf(captured.orderId)).toBe("expired");
    expect(await statusOf(authorized.orderId)).toBe("pending_payment");
  });

  it("المحميّ لا يحجز نافذة الدفعة: الحد 1 ينهي التالي له", async () => {
    const protectedOrder = await newOrder();
    unwrap(await start(protectedOrder));
    const free = await newOrder();
    expect(await expireAllDueOrders(db, { now: AFTER_DEADLINE, limit: 1 })).toBe(1);
    expect(await statusOf(free)).toBe("expired");
    expect(await statusOf(protectedOrder)).toBe("pending_payment");
  });

  it("createOrder لا ينهي طلب العميل الفائت ذا المحاولة الحيّة", async () => {
    const buyer = testBuyer(testPhone(9_000_001));
    const first = unwrap(await createOrder(db, orderInput(plan.slug, PLAN_PRICE, { buyer })));
    unwrap(await start(first.orderId));
    const later = orderInput(plan.slug, PLAN_PRICE, { buyer, now: AFTER_DEADLINE });
    unwrap(await createOrder(db, later));
    expect(await statusOf(first.orderId)).toBe("pending_payment");
  });
});

describe("سباق بدء الدفع مع الإنهاء", () => {
  it("الإنهاء يسبق إلى القفل: بدء الدفع ينتظره ثم يُرفض بلا محاولة", async () => {
    const orderId = await newOrder();
    let release = (): void => undefined;
    const held = new Promise<void>((resolve) => (release = resolve));
    let signalExpired = (): void => undefined;
    const expired = new Promise<void>((resolve) => (signalExpired = resolve));
    const expiring = other.$transaction(async (tx) => {
      expect(await expireDueOrders(tx, { now: AFTER_DEADLINE, limit: 10 })).toBe(1);
      signalExpired();
      await held;
    });
    await expired;
    const starting = start(orderId);
    release();
    await expiring;
    expect(failure(await starting)).toMatchObject({ reason: "order.not_payable" });
    expect(await db.paymentAttempt.count({ where: { orderId } })).toBe(0);
    expect(await statusOf(orderId)).toBe("expired");
  });

  it("بدء الدفع يسبق إلى القفل ولم يعتمد بعد: الإنهاء يتخطاه، وبعد الاعتماد يجده محميًّا", async () => {
    const orderId = await newOrder();
    let release = (): void => undefined;
    const held = new Promise<void>((resolve) => (release = resolve));
    let signalLocked = (): void => undefined;
    const locked = new Promise<void>((resolve) => (signalLocked = resolve));
    const starting = other.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id::text FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`;
      signalLocked();
      await held;
    });
    await locked;
    expect(await expire()).toBe(0);
    release();
    await starting;
    unwrap(await start(orderId));
    expect(await expire()).toBe(0);
    expect(await statusOf(orderId)).toBe("pending_payment");
  });

  it(
    `${String(RACE_ROUNDS)} جولة متزامنة: لا طلب منتهٍ ومعه محاولة حيّة أبدًا`,
    async () => {
      let started = 0;
      let expiredFirst = 0;
      for (let round = 0; round < RACE_ROUNDS; round += 1) {
        const orderId = await newOrder();
        const startFirst = round % 2 === 0;
        const startCall = () => start(orderId, other);
        const [attempt, expiredCount] = startFirst
          ? await Promise.all([startCall(), expire()])
          : await Promise.all([expire(), startCall()]).then(
              ([count, result]) => [result, count] as const,
            );
        const status = await statusOf(orderId);
        const live = await db.paymentAttempt.count({ where: { orderId } });
        if (attempt.ok) {
          started += 1;
          expect([status, expiredCount, live]).toEqual(["pending_payment", 0, 1]);
        } else {
          expiredFirst += 1;
          expect(attempt.error.reason).toBe("order.not_payable");
          expect([status, expiredCount, live]).toEqual(["expired", 1, 0]);
        }
      }
      expect(started + expiredFirst).toBe(RACE_ROUNDS);
      const broken = await db.$queryRaw<{ count: number }[]>`
        SELECT count(*)::int AS count FROM orders o JOIN payment_attempts a ON a.order_id = o.id
        WHERE o.status = 'expired' AND payment_attempt_is_live(a.status, a.settled_at)`;
      expect(broken[0]?.count).toBe(0);
    },
    RACE_TIMEOUT_MS,
  );
});
