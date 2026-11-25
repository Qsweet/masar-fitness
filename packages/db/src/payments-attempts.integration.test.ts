import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  claimAttemptSync,
  createDb,
  createOrder,
  createPaymentAttempt,
  findAttemptBySession,
  findLatestAttemptForOrder,
  getOrderPaymentSummary,
  markAttemptStartFailed,
  markOrderPaid,
  markSessionOpened,
  recordSyncFailure,
  type Db,
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
  TEST_MIN_PAYMENT_MINUTES,
  TEST_PROVIDER,
  testSessionId,
} from "./test-support/payments-fixtures";
import { resetCommerceTables } from "./test-support/reset-database";

const PLAN_PRICE = 90_000;
const MINUTE_MS = 60_000;
const MARGIN_MINUTES = 5;
const LEASE_MS = 30_000;
const CLIENTS = 20;

let db: Db;
let plan: TestProduct;
let phoneIndex = 0;

beforeAll(async () => {
  db = createDb(testDatabaseUrl());
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
  await db.$disconnect();
});

function at(minutes: number): Date {
  return new Date(TEST_NOW.getTime() + minutes * MINUTE_MS);
}

async function newOrder(): Promise<string> {
  phoneIndex += 1;
  const input = orderInput(plan.slug, PLAN_PRICE, { buyer: testBuyer(testPhone(phoneIndex)) });
  return unwrap(await createOrder(db, input)).orderId;
}

function start(orderId: string, now = TEST_NOW, client = db, provider = TEST_PROVIDER) {
  return createPaymentAttempt(client, {
    orderId,
    provider,
    providerMode: "test",
    minPaymentMinutes: TEST_MIN_PAYMENT_MINUTES,
    now,
  });
}

function auditActions(entityId: string): Promise<string[]> {
  return db.auditLog
    .findMany({ where: { entityId } })
    .then((rows) => rows.map((row) => row.action).sort());
}

describe("createPaymentAttempt", () => {
  it("ينشئ محاولة created بلقطة مبلغ الطلب وموعد قبل المهلة بالهامش، مع سطر تدقيق", async () => {
    const orderId = await newOrder();
    const started = unwrap(await start(orderId));
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(started).toMatchObject({ reused: false, orderReference: order.reference });
    expect(started.attempt).toMatchObject({
      orderId,
      provider: TEST_PROVIDER,
      providerMode: "test",
      status: "created",
      amountMinor: PLAN_PRICE,
      currency: "SAR",
      deadlineAt: at(TEST_PAYMENT_WINDOW_MINUTES - MARGIN_MINUTES),
      providerSessionId: null,
    });
    const audit = await db.auditLog.findFirstOrThrow({ where: { entityId: started.attempt.id } });
    expect(audit).toMatchObject({
      entityType: "payment_attempt",
      action: "payment_attempt_created",
      toState: "created",
      actor: "customer",
    });
    expect(JSON.stringify(audit.data)).not.toMatch(/9665|عميل/);
  });

  it("النداء الثاني يرجع المحاولة الحيّة نفسها: الضغطتان محاولة واحدة", async () => {
    const orderId = await newOrder();
    const first = unwrap(await start(orderId));
    const second = unwrap(await start(orderId, at(1)));
    expect(second).toMatchObject({ reused: true });
    expect(second.attempt.id).toBe(first.attempt.id);
    expect(await db.paymentAttempt.count({ where: { orderId } })).toBe(1);
  });

  it("عشرون نداءً متزامنًا: محاولة واحدة والباقي يرجعها", async () => {
    const orderId = await newOrder();
    const clients = createDbClients(CLIENTS);
    try {
      const results = await Promise.all(
        clients.map((client) => start(orderId, TEST_NOW, client).then(unwrap)),
      );
      expect(new Set(results.map((result) => result.attempt.id)).size).toBe(1);
      expect(results.filter((result) => !result.reused)).toHaveLength(1);
      expect(await db.paymentAttempt.count({ where: { orderId } })).toBe(1);
    } finally {
      await disconnectAll(clients);
    }
  });

  it("محاولة حيّة عند مزوّد آخر تمنع البدء عند غيره", async () => {
    const orderId = await newOrder();
    unwrap(await start(orderId));
    const other = failure(await start(orderId, TEST_NOW, db, "other_pay"));
    expect(other).toMatchObject({ code: "conflict", reason: "payment.attempt_in_progress" });
  });

  it("الوقت الباقي: يكفي تمامًا يُقبل، وأقل بملّي ثانية يُرفض بلا صف", async () => {
    const orderId = await newOrder();
    const latest = TEST_PAYMENT_WINDOW_MINUTES - MARGIN_MINUTES - TEST_MIN_PAYMENT_MINUTES;
    const tooLate = failure(await start(orderId, new Date(at(latest).getTime() + 1)));
    expect(tooLate).toMatchObject({ code: "conflict", reason: "payment.window_too_short" });
    expect(await db.paymentAttempt.count({ where: { orderId } })).toBe(0);
    expect(unwrap(await start(orderId, at(latest))).reused).toBe(false);
  });

  it("طلب مدفوع أو غير موجود لا تبدأ له محاولة", async () => {
    const orderId = await newOrder();
    const payment = {
      provider: TEST_PROVIDER,
      providerPaymentId: "manual-1",
      amountMinor: PLAN_PRICE,
      currency: "SAR",
    };
    unwrap(await markOrderPaid(db, { orderId, payment, actor: "system", now: TEST_NOW }));
    expect(failure(await start(orderId))).toMatchObject({ reason: "order.not_payable" });
    const missing = "0193a000-0000-7000-8000-00000000dead";
    expect(failure(await start(missing))).toMatchObject({ code: "not_found" });
  });
});

describe("بداية الجلسة وفشلها", () => {
  it("markSessionOpened: created ← pending بمعرّف الجلسة، وتُعرف المحاولة به", async () => {
    const orderId = await newOrder();
    const { attempt } = unwrap(await start(orderId));
    const sessionId = testSessionId(attempt.id);
    const opened = unwrap(
      await markSessionOpened(db, {
        attemptId: attempt.id,
        providerSessionId: sessionId,
        providerStatus: "initiated",
        now: at(1),
      }),
    );
    expect(opened).toMatchObject({ status: "pending", providerSessionId: sessionId });
    expect((await findAttemptBySession(db, TEST_PROVIDER, sessionId))?.id).toBe(attempt.id);
    expect(await findAttemptBySession(db, "other_pay", sessionId)).toBeUndefined();
    expect(await auditActions(attempt.id)).toEqual([
      "payment_attempt_created",
      "payment_attempt_session_opened",
    ]);
    const again = failure(
      await markSessionOpened(db, {
        attemptId: attempt.id,
        providerSessionId: "another",
        providerStatus: "initiated",
        now: at(2),
      }),
    );
    expect(again.reason).toBe("payment_attempt.invalid_transition");
  });

  it("markAttemptStartFailed: المحاولة failed بسببها، ويمكن بدء محاولة جديدة", async () => {
    const orderId = await newOrder();
    const { attempt } = unwrap(await start(orderId));
    const failed = unwrap(
      await markAttemptStartFailed(db, {
        attemptId: attempt.id,
        reason: "provider_unreachable",
        now: at(1),
      }),
    );
    expect(failed).toMatchObject({ status: "failed", failureReason: "provider_unreachable" });
    const retry = unwrap(await start(orderId, at(2)));
    expect(retry.reused).toBe(false);
    expect(retry.attempt.id).not.toBe(attempt.id);
    expect((await findLatestAttemptForOrder(db, orderId))?.id).toBe(retry.attempt.id);
  });

  it("محاولة فُتحت جلستها لا تُفشَّل كبداية منقطعة", async () => {
    const { attempt } = unwrap(await start(await newOrder()));
    unwrap(
      await markSessionOpened(db, {
        attemptId: attempt.id,
        providerSessionId: testSessionId(attempt.id),
        providerStatus: "initiated",
        now: at(1),
      }),
    );
    const late = failure(
      await markAttemptStartFailed(db, {
        attemptId: attempt.id,
        reason: "start_interrupted",
        now: at(2),
      }),
    );
    expect(late.reason).toBe("payment_attempt.invalid_transition");
    const row = await db.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(row.status).toBe("pending");
  });
});

describe("مطالبة المزامنة", () => {
  it("مطالبة واحدة في كل لحظة، وتتحرر بانتهاء عمرها أو بتسجيل تعذّر القراءة", async () => {
    const { attempt } = unwrap(await start(await newOrder()));
    const claim = (now: Date) =>
      claimAttemptSync(db, { attemptId: attempt.id, now, leaseMs: LEASE_MS });
    expect((await claim(TEST_NOW))?.id).toBe(attempt.id);
    expect(await claim(new Date(TEST_NOW.getTime() + LEASE_MS))).toBeUndefined();
    expect((await claim(new Date(TEST_NOW.getTime() + LEASE_MS + 1)))?.id).toBe(attempt.id);
    await recordSyncFailure(db, attempt.id, at(2));
    const row = await db.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(row).toMatchObject({ syncLeaseUntil: null, checkCount: 1, lastCheckedAt: at(2) });
    expect((await claim(at(2)))?.id).toBe(attempt.id);
  });

  it("عشرون مطالبة متزامنة: واحدة تنالها", async () => {
    const { attempt } = unwrap(await start(await newOrder()));
    const clients = createDbClients(CLIENTS);
    try {
      const claims = await Promise.all(
        clients.map((client) =>
          claimAttemptSync(client, { attemptId: attempt.id, now: TEST_NOW, leaseMs: LEASE_MS }),
        ),
      );
      expect(claims.filter((claimed) => claimed !== undefined)).toHaveLength(1);
    } finally {
      await disconnectAll(clients);
    }
  });
});

describe("getOrderPaymentSummary", () => {
  it("يعكس المحاولة الحيّة ثم الفاشلة", async () => {
    const orderId = await newOrder();
    expect(await getOrderPaymentSummary(db, orderId)).toEqual({
      liveAttempt: null,
      lastAttemptFailed: false,
      hasOpenIncident: false,
    });
    const { attempt } = unwrap(await start(orderId));
    expect(await getOrderPaymentSummary(db, orderId)).toMatchObject({
      liveAttempt: { status: "created", deadlineAt: attempt.deadlineAt },
      lastAttemptFailed: false,
    });
    unwrap(
      await markAttemptStartFailed(db, {
        attemptId: attempt.id,
        reason: "provider_rejected",
        now: at(1),
      }),
    );
    expect(await getOrderPaymentSummary(db, orderId)).toMatchObject({
      liveAttempt: null,
      lastAttemptFailed: true,
    });
  });
});
