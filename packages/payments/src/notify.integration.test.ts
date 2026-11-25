import { expireDueOrders, getOrderPaymentSummary, type Db } from "@masar/db";
import {
  createDbClients,
  createPlan,
  createTestClub,
  disconnectAll,
  resetCommerceTables,
  testDatabaseUrl,
  TEST_NOW,
  TEST_PAYMENT_WINDOW_MINUTES,
  type TestProduct,
} from "@masar/db/test-support";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { handlePaymentNotification } from "./notify";
import { syncAttempt } from "./sync";
import { createHarness, newPendingOrder, startRedirect, type Harness } from "./test-support";

const PLAN_PRICE = 90_000;
const MINUTE_MS = 60_000;
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

describe("handlePaymentNotification", () => {
  function update(paymentId: string | null, sessionId: string | null) {
    return {
      kind: "payment_update",
      eventId: "e-1",
      eventType: "payment_paid",
      paymentId,
      sessionId,
    } as const;
  }

  it("الإشعار نفسه ثلاث مرات ثم عشر مرات بالتوازي: تفعيل واحد", async () => {
    const orderId = await newOrder();
    const { attempt } = await startRedirect(harness.deps, orderId);
    const sessionId = attempt.providerSessionId ?? "";
    const payment = harness.store.addPayment(sessionId, { state: "paid" });
    const event = update(payment?.paymentId ?? null, sessionId);
    for (let round = 0; round < 3; round += 1) {
      await handlePaymentNotification(harness.deps, event);
    }
    await Promise.all(
      clients.map((client) => handlePaymentNotification({ ...harness.deps, db: client }, event)),
    );
    expect(await db.membership.count({ where: { orderId } })).toBe(1);
    expect(
      await db.auditLog.count({ where: { entityId: orderId, action: "payment_verified" } }),
    ).toBe(1);
    expect(harness.logs.filter((line) => line.event === "payment.settled")).toHaveLength(1);
  });

  it("إشعار يقول paid والمزوّد يقول failed: لا تفعيل (الجسم لا يُصدَّق)", async () => {
    const orderId = await newOrder();
    const { attempt } = await startRedirect(harness.deps, orderId);
    const sessionId = attempt.providerSessionId ?? "";
    const payment = harness.store.addPayment(sessionId, { state: "failed" });
    await handlePaymentNotification(harness.deps, update(payment?.paymentId ?? null, sessionId));
    expect(await orderStatus(orderId)).toBe("pending_payment");
    expect(await db.membership.count()).toBe(0);
    expect(await attemptStatus(attempt.id)).toBe("pending");
  });

  it("إشعار بلا معرّف جلسة: تُقرأ جلسة الدفعة من المزوّد", async () => {
    const orderId = await newOrder();
    const { attempt } = await startRedirect(harness.deps, orderId);
    const payment = harness.store.addPayment(attempt.providerSessionId ?? "", { state: "paid" });
    const result = await handlePaymentNotification(
      harness.deps,
      update(payment?.paymentId ?? null, null),
    );
    expect(result.kind).toBe("synced");
    expect(await orderStatus(orderId)).toBe("fulfilled");
  });

  it("مرجع لا نعرفه (نظام آخر على الحساب نفسه): يُتجاهل بلا كتابة", async () => {
    await startRedirect(harness.deps, await newOrder());
    const audits = await db.auditLog.count();
    const result = await handlePaymentNotification(
      harness.deps,
      update("crm-payment", "crm-session"),
    );
    expect(result).toEqual({ kind: "unknown_reference" });
    expect(await handlePaymentNotification(harness.deps, update(null, null))).toEqual({
      kind: "unknown_reference",
    });
    expect(await db.auditLog.count()).toBe(audits);
    expect(await db.paymentIncident.count()).toBe(0);
  });

  it("مبلغ لا يطابق: حادثة وسطر تنبيه واحد، والطلب لا يُفعَّل، والسجل بلا بيانات شخصية", async () => {
    const orderId = await newOrder();
    const { attempt } = await startRedirect(harness.deps, orderId);
    const sessionId = attempt.providerSessionId ?? "";
    const payment = harness.store.addPayment(sessionId, {
      state: "paid",
      amountMinor: PLAN_PRICE - 500,
    });
    const event = update(payment?.paymentId ?? null, sessionId);
    await handlePaymentNotification(harness.deps, event);
    await handlePaymentNotification(harness.deps, event);
    expect(await orderStatus(orderId)).toBe("pending_payment");
    expect(await db.membership.count()).toBe(0);
    const alerts = harness.logs.filter((line) => line.event === "payment.incident_open");
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      level: "error",
      fields: { incident: "amount_mismatch", attemptId: attempt.id },
    });
    expect(await getOrderPaymentSummary(db, orderId)).toMatchObject({ hasOpenIncident: true });
    expect(JSON.stringify(harness.logs)).not.toMatch(/9665|عميل اختبار|secret/i);
  });

  it("بعد موعد الجلسة بلا دفع: المحاولة expired ثم يُنهى الطلب بعد مهلته", async () => {
    const orderId = await newOrder();
    const { attempt } = await startRedirect(harness.deps, orderId);
    const afterExpiry = new Date(
      TEST_NOW.getTime() + (TEST_PAYMENT_WINDOW_MINUTES + 1) * MINUTE_MS,
    );
    expect(await expireDueOrders(db, { now: afterExpiry, limit: 10 })).toBe(0);
    harness.setMinutes(TEST_PAYMENT_WINDOW_MINUTES + 1);
    await syncAttempt(harness.deps, attempt.id, "reconcile");
    expect(await attemptStatus(attempt.id)).toBe("expired");
    expect(await expireDueOrders(db, { now: afterExpiry, limit: 10 })).toBe(1);
    expect(await orderStatus(orderId)).toBe("expired");
  });
});
