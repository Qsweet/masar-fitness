import { expireDueOrders, withReconcileLock, type Db } from "@masar/db";
import {
  createDbClients,
  createPlan,
  createTestClub,
  disconnectAll,
  resetCommerceTables,
  TEST_NOW,
  TEST_PAYMENT_WINDOW_MINUTES,
  type TestProduct,
} from "@masar/db/test-support";
import { err, ok, type Result } from "@masar/domain";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ProviderError, type HostedPayment, type PaymentProvider } from "./port";
import { reconcileOnce, runReconcile } from "./reconcile";
import { syncAttempt } from "./sync";
import { createHarness, newPendingOrder, start, startRedirect, type Harness } from "./test-support";
import { isSyncDue, reconcileIntervalMs } from "./timing";

const PLAN_PRICE = 90_000;
const MINUTE_MS = 60_000;
const HOUR_MINUTES = 60;
const DAY_MINUTES = 1_440;
const LOCK_TIMEOUT_MS = 10_000;

let db: Db;
let other: Db;
let plan: TestProduct;
let harness: Harness;

beforeAll(async () => {
  [db, other] = createDbClients(2) as [Db, Db];
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
  await disconnectAll([db, other]);
});

function newOrder(): Promise<string> {
  return newPendingOrder(db, plan.slug, PLAN_PRICE);
}

function attemptRow(attemptId: string) {
  return db.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId } });
}

function incidentKinds(attemptId: string) {
  return db.paymentIncident
    .findMany({ where: { attemptId } })
    .then((rows) => rows.map((row) => row.kind));
}

describe("فواصل المطابقة", () => {
  it("تراجع أسّي من دقيقتين حتى سقف نصف ساعة", () => {
    const minutes = [0, 1, 2, 3, 4, 5, 6, 50].map(
      (count) => reconcileIntervalMs(count) / MINUTE_MS,
    );
    expect(minutes).toEqual([2, 2, 4, 8, 16, 30, 30, 30]);
  });

  it("isSyncDue: ما لم يُفحص قط مستحق، وغيره بعد فاصله", () => {
    const checked = new Date(TEST_NOW.getTime() - 4 * MINUTE_MS);
    expect(isSyncDue(null, 0, TEST_NOW)).toBe(true);
    expect(isSyncDue(checked, 2, TEST_NOW)).toBe(true);
    expect(isSyncDue(checked, 3, TEST_NOW)).toBe(false);
  });
});

describe("reconcileOnce", () => {
  it("دفع معلّق لم يصل إشعاره ولم يعد صاحبه: المطابقة تحسمه", async () => {
    const orderId = await newOrder();
    const { attempt } = await startRedirect(harness.deps, orderId);
    const sessionId = attempt.providerSessionId ?? "";
    const payment = harness.store.addPayment(sessionId, { state: "in_progress" });
    harness.setMinutes(3);
    expect(await reconcileOnce(harness.deps)).toMatchObject({ synced: 1, cancelled: 0 });
    expect((await attemptRow(attempt.id)).status).toBe("pending");
    harness.store.setPaymentState(payment?.paymentId ?? "", "paid");
    harness.setMinutes(4);
    // فُحصت قبل دقيقة: فاصلها لم يحن
    expect(await reconcileOnce(harness.deps)).toMatchObject({ synced: 0 });
    harness.setMinutes(6);
    expect(await reconcileOnce(harness.deps)).toMatchObject({ synced: 1 });
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe("fulfilled");
    expect(await db.membership.count({ where: { orderId } })).toBe(1);
  });

  it("بلوغ الموعد: تُلغى الجلسة عند المزوّد ثم تصير المحاولة expired، ثم يُنهى الطلب", async () => {
    const orderId = await newOrder();
    const { attempt } = await startRedirect(harness.deps, orderId);
    const afterExpiry = TEST_PAYMENT_WINDOW_MINUTES + 1;
    harness.setMinutes(afterExpiry);
    expect(await reconcileOnce(harness.deps)).toMatchObject({ synced: 1, cancelled: 1 });
    expect(harness.store.get(attempt.providerSessionId ?? "")?.state).toBe("closed");
    expect((await attemptRow(attempt.id)).status).toBe("expired");
    const now = new Date(TEST_NOW.getTime() + afterExpiry * MINUTE_MS);
    expect(await expireDueOrders(db, { now, limit: 10 })).toBe(1);
  });

  it("دفعة بقيت جارية بعد الموعد والعتبة: حادثة stuck_pending، والطلب يبقى محميًّا", async () => {
    const orderId = await newOrder();
    const { attempt } = await startRedirect(harness.deps, orderId);
    harness.store.addPayment(attempt.providerSessionId ?? "", { state: "in_progress" });
    const late = TEST_PAYMENT_WINDOW_MINUTES + HOUR_MINUTES;
    harness.setMinutes(late);
    await reconcileOnce(harness.deps);
    expect(await incidentKinds(attempt.id)).toEqual(["stuck_pending"]);
    expect((await attemptRow(attempt.id)).status).toBe("pending");
    const now = new Date(TEST_NOW.getTime() + late * MINUTE_MS);
    expect(await expireDueOrders(db, { now, limit: 10 })).toBe(0);
    const alerts = harness.logs.filter((line) => line.event === "payment.incident_open");
    expect(alerts).toHaveLength(1);
  });

  it("عكس لاحق من المزوّد يُكشف في الفحص اليومي: حادثة، والطلب لا يتغير", async () => {
    const orderId = await newOrder();
    const { attempt } = await startRedirect(harness.deps, orderId);
    const payment = harness.store.addPayment(attempt.providerSessionId ?? "", { state: "paid" });
    await syncAttempt(harness.deps, attempt.id, "return");
    harness.store.setPaymentState(payment?.paymentId ?? "", "voided");
    harness.setMinutes(DAY_MINUTES - 1);
    expect(await reconcileOnce(harness.deps)).toMatchObject({ rechecked: 0 });
    harness.setMinutes(DAY_MINUTES + 1);
    expect(await reconcileOnce(harness.deps)).toMatchObject({ rechecked: 1 });
    expect(await incidentKinds(attempt.id)).toEqual(["provider_reversed"]);
    expect((await attemptRow(attempt.id)).status).toBe("voided");
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe("fulfilled");
  });

  it("محاولة توقفت عمليتها وهي created: تُكتب failed فيتحرر الطلب", async () => {
    const orderId = await newOrder();
    const hanging: PaymentProvider = {
      ...harness.deps.provider,
      createHostedPayment: () => new Promise<Result<HostedPayment, ProviderError>>(() => undefined),
    };
    void start(harness.withProvider(hanging), orderId);
    await expect.poll(() => db.paymentAttempt.count({ where: { orderId } })).toBe(1);
    harness.setMinutes(4);
    expect(await reconcileOnce(harness.deps)).toMatchObject({ interrupted: 0 });
    harness.setMinutes(6);
    expect(await reconcileOnce(harness.deps)).toMatchObject({ interrupted: 1 });
    const attempt = await db.paymentAttempt.findFirstOrThrow({ where: { orderId } });
    expect(attempt).toMatchObject({ status: "failed", failureReason: "start_interrupted" });
  });

  it("جلسة يتيمة بعد انقطاع الإنشاء: تُكتشف بمعرّف المحاولة وتُلغى", async () => {
    const orderId = await newOrder();
    const lostReply: PaymentProvider = {
      ...harness.deps.provider,
      async createHostedPayment(request) {
        await harness.deps.provider.createHostedPayment(request);
        return err(new ProviderError("unreachable", { code: "network_or_timeout" }));
      },
    };
    await start(harness.withProvider(lostReply), orderId);
    const attempt = await db.paymentAttempt.findFirstOrThrow({ where: { orderId } });
    const [orphan] = harness.store.sessionsForAttempt(attempt.id);
    expect(harness.store.get(orphan ?? "")?.state).toBe("open");
    harness.setMinutes(1);
    expect(await reconcileOnce(harness.deps)).toMatchObject({ orphans: 1 });
    expect(harness.store.get(orphan ?? "")?.state).toBe("closed");
  });

  it("مزوّد لم يُتحقق من بحثه بعد (WP0): تُتخطى خطوة اليتيمة بتحذير، والباقي يعمل", async () => {
    const orderId = await newOrder();
    const unverified: PaymentProvider = {
      ...harness.deps.provider,
      createHostedPayment: () => Promise.resolve(err(new ProviderError("unreachable"))),
      findSessionsForAttempt: () =>
        Promise.resolve(
          err(
            new ProviderError("needs_sandbox_verification", {
              code: "moyasar.list_invoices_by_metadata",
            }),
          ),
        ),
    };
    const deps = harness.withProvider(unverified);
    await start(deps, orderId);
    harness.setMinutes(1);
    expect(await reconcileOnce(deps)).toMatchObject({ orphans: 0 });
    const warnings = harness.logs.filter(
      (line) => line.event === "payment.needs_sandbox_verification",
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      level: "warn",
      fields: { errorCode: "moyasar.list_invoices_by_metadata" },
    });
  });
});

describe("runReconcile", () => {
  it("دورة واحدة في كل لحظة: الثانية ترجع فورًا بلا عمل", async () => {
    let release = (): void => undefined;
    const working = new Promise<void>((resolve) => (release = resolve));
    let signalStarted = (): void => undefined;
    const started = new Promise<void>((resolve) => (signalStarted = resolve));
    const first = withReconcileLock(other, LOCK_TIMEOUT_MS, async () => {
      signalStarted();
      await working;
      return ok("done");
    });
    await started;
    expect(await runReconcile(harness.deps)).toEqual({ ran: false });
    release();
    expect(await first).toMatchObject({ ran: true });
    expect(await runReconcile(harness.deps)).toMatchObject({ ran: true, value: { synced: 0 } });
  });
});
