import type { Db } from "@masar/db";
import {
  createDbClients,
  createPlan,
  createTestClub,
  disconnectAll,
  failure,
  resetCommerceTables,
  testDatabaseUrl,
  TEST_PAYMENT_WINDOW_MINUTES,
  type TestProduct,
} from "@masar/db/test-support";
import { err, type Result } from "@masar/domain";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ProviderError, type HostedPayment, type PaymentProvider } from "./port";
import { syncAttempt } from "./sync";
import { createHarness, newPendingOrder, start, startRedirect, type Harness } from "./test-support";

const PLAN_PRICE = 90_000;
const PARALLEL = 10;

let db: Db;
let clients: Db[];
let plan: TestProduct;
let harness: Harness;

beforeAll(async () => {
  [db, ...clients] = createDbClients(PARALLEL + 1) as [Db, ...Db[]];
  expect(testDatabaseUrl()).toContain("_test");
  await resetCommerceTables(db);
  const clubId = await createTestClub(db);
  plan = await createPlan(db, clubId, { priceMinor: PLAN_PRICE, durationMonths: 1 });
});

beforeEach(async () => {
  await db.$executeRaw`
    TRUNCATE audit_logs, memberships, order_discounts, order_items, orders, customers CASCADE`;
  harness = createHarness(db);
});

afterAll(async () => {
  await resetCommerceTables(db);
  await disconnectAll([db, ...clients]);
});

function newOrder(): Promise<string> {
  return newPendingOrder(db, plan.slug, PLAN_PRICE);
}

function orderStatus(orderId: string) {
  return db.order.findUniqueOrThrow({ where: { id: orderId } }).then((order) => order.status);
}

function attemptStatus(attemptId: string) {
  return db.paymentAttempt
    .findUniqueOrThrow({ where: { id: attemptId } })
    .then((attempt) => attempt.status);
}

describe("startPayment", () => {
  it("ينشئ جلسة عند المزوّد بمبلغ الطلب وموعده ومرجعه، ويرجع رابط صفحتها", async () => {
    const orderId = await newOrder();
    const { result, attempt } = await startRedirect(harness.deps, orderId);
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(result.url).toBe(`http://127.0.0.1/checkout/demo-pay/fake_s_${attempt.id}`);
    expect(attempt).toMatchObject({ status: "pending", provider: "fake", providerMode: "test" });
    expect(harness.store.get(attempt.providerSessionId ?? "")?.request).toMatchObject({
      attemptId: attempt.id,
      orderReference: order.reference,
      amountMinor: PLAN_PRICE,
      currency: "SAR",
      description: `طلب ${order.reference}`,
      expiresAt: attempt.deadlineAt,
    });
    expect(attempt.deadlineAt.getTime()).toBeLessThan(order.expiresAt.getTime());
  });

  it("الضغطة الثانية ترجع صفحة الجلسة نفسها: محاولة واحدة وجلسة واحدة", async () => {
    const orderId = await newOrder();
    const first = await startRedirect(harness.deps, orderId);
    const second = await startRedirect(harness.deps, orderId);
    expect(second.result).toEqual(first.result);
    expect(await db.paymentAttempt.count({ where: { orderId } })).toBe(1);
  });

  it("عشر ضغطات متزامنة: محاولة واحدة، ولا جلسة ثانية", async () => {
    const orderId = await newOrder();
    const results = await Promise.all(
      clients.map((client) => start({ ...harness.deps, db: client }, orderId)),
    );
    expect(results.every((result) => result.ok)).toBe(true);
    expect(await db.paymentAttempt.count({ where: { orderId } })).toBe(1);
    const attempt = await db.paymentAttempt.findFirstOrThrow({ where: { orderId } });
    expect(attempt.status).toBe("pending");
    expect(harness.store.sessionsForAttempt(attempt.id)).toHaveLength(1);
  });

  it("انقطاع عند إنشاء الجلسة: المحاولة failed بلا إعادة، ويمكن البدء من جديد", async () => {
    const orderId = await newOrder();
    let calls = 0;
    const unreachable: PaymentProvider = {
      ...harness.deps.provider,
      createHostedPayment(): Promise<Result<HostedPayment, ProviderError>> {
        calls += 1;
        return Promise.resolve(
          err(new ProviderError("unreachable", { code: "network_or_timeout" })),
        );
      },
    };
    const failed = failure(await start(harness.withProvider(unreachable), orderId));
    expect(failed).toMatchObject({ code: "conflict", reason: "payment.provider_unavailable" });
    expect(calls).toBe(1);
    const attempt = await db.paymentAttempt.findFirstOrThrow({ where: { orderId } });
    expect(attempt).toMatchObject({ status: "failed", failureReason: "provider_unreachable" });
    const failures = harness.logs.filter((line) => line.event === "payment.attempt_start_failed");
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({ level: "error", fields: { errorKind: "unreachable" } });
    const retry = await startRedirect(harness.deps, orderId);
    expect(retry.attempt.id).not.toBe(attempt.id);
  });

  it("رفض المزوّد أو عطل محوّله: provider_rejected أو provider_unreachable، والطلب معلّق", async () => {
    const orderId = await newOrder();
    const rejecting: PaymentProvider = {
      ...harness.deps.provider,
      createHostedPayment: () =>
        Promise.resolve(
          err(new ProviderError("rejected", { httpStatus: 400, code: "invalid_request" })),
        ),
    };
    failure(await start(harness.withProvider(rejecting), orderId));
    const throwing: PaymentProvider = {
      ...harness.deps.provider,
      createHostedPayment: () => Promise.reject(new Error("boom")),
    };
    failure(await start(harness.withProvider(throwing), orderId));
    const reasons = await db.paymentAttempt.findMany({
      where: { orderId },
      orderBy: { createdAt: "asc" },
    });
    expect(reasons.map((row) => row.failureReason).sort()).toEqual([
      "provider_rejected",
      "provider_unreachable",
    ]);
    expect(await orderStatus(orderId)).toBe("pending_payment");
  });

  it("لا وقت يكفي للدفع: يُرفض قبل أي استدعاء للمزوّد", async () => {
    const orderId = await newOrder();
    harness.setMinutes(TEST_PAYMENT_WINDOW_MINUTES - 5);
    expect(failure(await start(harness.deps, orderId)).reason).toBe("payment.window_too_short");
    expect(await db.paymentAttempt.count()).toBe(0);
  });
});

describe("syncAttempt", () => {
  it("شراء ناجح: محاولة captured، وطلب مسلَّم، واشتراك واحد", async () => {
    const orderId = await newOrder();
    const { attempt } = await startRedirect(harness.deps, orderId);
    harness.store.addPayment(attempt.providerSessionId ?? "", { state: "paid" });
    harness.setMinutes(2);
    const result = await syncAttempt(harness.deps, attempt.id, "return");
    expect(result).toMatchObject({
      kind: "synced",
      outcome: { status: "captured", settlement: "paid", paidOrder: { status: "fulfilled" } },
    });
    expect(await orderStatus(orderId)).toBe("fulfilled");
    expect(await db.membership.count({ where: { orderId } })).toBe(1);
    const events = harness.logs.map((line) => line.event);
    expect(events).toEqual(["payment.attempt_created", "payment.sync", "payment.settled"]);
  });

  it("العميل عاد بلا دفع والجلسة صالحة: تبقى pending ويعود إلى الصفحة نفسها", async () => {
    const orderId = await newOrder();
    const { attempt, result } = await startRedirect(harness.deps, orderId);
    const synced = await syncAttempt(harness.deps, attempt.id, "return");
    expect(synced).toMatchObject({
      kind: "synced",
      outcome: { status: "pending", settlement: null },
    });
    expect((await startRedirect(harness.deps, orderId)).result.url).toBe(result.url);
  });

  it("دفع فاشل وجلسة مغلقة: محاولة failed، والطلب معلّق ويقبل محاولة جديدة", async () => {
    const orderId = await newOrder();
    const { attempt } = await startRedirect(harness.deps, orderId);
    const sessionId = attempt.providerSessionId ?? "";
    harness.store.addPayment(sessionId, { state: "failed" });
    harness.store.close(sessionId);
    await syncAttempt(harness.deps, attempt.id, "webhook");
    expect(await attemptStatus(attempt.id)).toBe("failed");
    expect(await orderStatus(orderId)).toBe("pending_payment");
    const retry = await startRedirect(harness.deps, orderId);
    expect(retry.attempt.id).not.toBe(attempt.id);
  });

  it("مزامنات متزامنة أثناء قراءة المزوّد: واحدة تقرؤه والباقي تكتفي بها", async () => {
    const { attempt } = await startRedirect(harness.deps, await newOrder());
    harness.store.addPayment(attempt.providerSessionId ?? "", { state: "paid" });
    const before = harness.store.fetchCount;
    let release = (): void => undefined;
    const reading = new Promise<void>((resolve) => (release = resolve));
    const slow: PaymentProvider = {
      ...harness.deps.provider,
      async fetchSession(sessionId) {
        await reading;
        return harness.deps.provider.fetchSession(sessionId);
      },
    };
    const deps = harness.withProvider(slow);
    let settled = 0;
    const syncs = clients.map((client) =>
      syncAttempt({ ...deps, db: client }, attempt.id, "webhook").finally(() => {
        settled += 1;
      }),
    );
    // صاحب المطالبة ينتظر المزوّد؛ الباقون يجب أن يرجعوا دون انتظاره
    await expect.poll(() => settled).toBe(PARALLEL - 1);
    release();
    const kinds = (await Promise.all(syncs)).map((result) => result.kind).sort();
    expect(kinds).toEqual([...Array<string>(PARALLEL - 1).fill("busy"), "synced"]);
    expect(harness.store.fetchCount - before).toBe(1);
    expect(await db.membership.count()).toBe(1);
  });

  it("تعذّر قراءة المزوّد: الحالة لا تتغير، ويُعدّ الفحص وتتحرر المطالبة", async () => {
    const { attempt } = await startRedirect(harness.deps, await newOrder());
    const down: PaymentProvider = {
      ...harness.deps.provider,
      fetchSession: () =>
        Promise.resolve(err(new ProviderError("unreachable", { httpStatus: 503 }))),
    };
    const result = await syncAttempt(harness.withProvider(down), attempt.id, "reconcile");
    expect(result.kind).toBe("provider_error");
    const row = await db.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(row).toMatchObject({ status: "pending", checkCount: 1, syncLeaseUntil: null });
    expect((await syncAttempt(harness.deps, attempt.id, "reconcile")).kind).toBe("synced");
  });

  it("محاولة مزوّد آخر لا تُقرأ بهذا المزوّد", async () => {
    const { attempt } = await startRedirect(harness.deps, await newOrder());
    const other: PaymentProvider = { ...harness.deps.provider, id: "other_pay" };
    const result = await syncAttempt(harness.withProvider(other), attempt.id, "reconcile");
    expect(result).toEqual({ kind: "skipped", reason: "other_provider" });
  });
});
