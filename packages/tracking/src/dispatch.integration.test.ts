import { randomUUID } from "node:crypto";
import {
  createDb,
  createOrder,
  markOrderPaid,
  purgeExpiredTracking,
  PURGE_REASON,
  recordOrderTracking,
  saveIntegration,
  type Db,
} from "@masar/db";
import {
  createPlan,
  createTestClub,
  createTestStaff,
  orderInput,
  resetCommerceTables,
  TEST_NOW,
  testDatabaseUrl,
  unwrap,
  type TestProduct,
} from "@masar/db/test-support";
import { CONSENT_VERSION, MAX_DELIVERY_ATTEMPTS, type TrackingProvider } from "@masar/domain";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { runDispatch } from "./dispatch";
import { sealTrackingSecret } from "./secret";
import { sendTestEvent } from "./send-test";
import { createFakeTransport, type FakeTransport } from "./transport";

const PRICE = 60_000;
const KEY = new Uint8Array(Array.from({ length: 32 }, (_, index) => index));
const SITE = "https://masar.test";

let db: Db;
let clubId: string;
let staffId: string;
let plan: TestProduct;
let fake: FakeTransport;
let now: Date;

beforeAll(async () => {
  db = createDb(testDatabaseUrl());
  await resetCommerceTables(db);
  clubId = await createTestClub(db);
  staffId = (await createTestStaff(db, clubId, { role: "owner" })).id;
  plan = await createPlan(db, clubId, { priceMinor: PRICE, durationMonths: 1, bonusMonths: 0 });
});

beforeEach(async () => {
  await db.$executeRaw`TRUNCATE tracking_outbox, order_tracking, tracking_integrations, audit_logs,
    memberships, order_discounts, order_items, orders, customers CASCADE`;
  fake = createFakeTransport();
  now = new Date();
});

afterAll(async () => {
  await resetCommerceTables(db);
  await db.$disconnect();
});

const CONFIG = {
  meta: { pixelId: "123456789012345" },
  ga4: { measurementId: "G-ABC1234" },
  openai: { pixelId: "1345349876" },
} as const;

async function enable(provider: keyof typeof CONFIG, options: { testCode?: string } = {}) {
  const sealed = sealTrackingSecret(KEY, clubId, provider, `${provider}-server-token`);
  unwrap(
    await saveIntegration(db, {
      clubId,
      provider,
      enabled: true,
      config: CONFIG[provider],
      testEventCode: options.testCode ?? null,
      secret: { kind: "set", ...sealed },
      staffId,
      actor: `staff:${staffId}`,
      now,
    }),
  );
}

async function paidOrder(
  gaClientId: string | null = "123.456",
  beforePayment: () => Promise<unknown> = () => Promise.resolve(),
  stampedAt: Date = now,
): Promise<string> {
  const { orderId } = unwrap(await createOrder(db, orderInput(plan.slug, PRICE)));
  await recordOrderTracking(db, {
    orderId,
    consent: { analytics: true, ads: true, version: CONSENT_VERSION, at: stampedAt },
    firstTouch: null,
    lastTouch: null,
    gaClientId,
    fbp: null,
    fbc: null,
    scid: null,
    ttp: null,
    obref: null,
    oppref: null,
    clientIp: "203.0.113.9",
    userAgent: "Mozilla/5.0",
    pageUrl: null,
    now: stampedAt,
  });
  await beforePayment();
  const payment = {
    provider: "test_pay",
    providerPaymentId: randomUUID(),
    amountMinor: PRICE,
    currency: "SAR",
  };
  unwrap(await markOrderPaid(db, { orderId, payment, actor: "provider", now }));
  return orderId;
}

function dispatch(at = now) {
  return runDispatch({
    db,
    transport: fake.transport,
    adminKey: KEY,
    siteUrl: SITE,
    clock: () => at,
  });
}

async function rows(provider: TrackingProvider) {
  return db.trackingOutbox.findMany({ where: { provider } });
}

describe("المرسِل", () => {
  it("يرسل الشراء مرة ويسجّل الرد، والدورة الثانية لا ترسل شيئًا", async () => {
    await enable("meta");
    await paidOrder();
    expect(await dispatch()).toMatchObject({ claimed: 1, sent: 1 });
    expect(fake.requests).toHaveLength(1);
    expect(fake.requests[0]?.url).toContain("graph.facebook.com/v27.0/123456789012345/events");
    expect(fake.requests[0]?.url).toContain("access_token=meta-server-token");
    expect((await rows("meta"))[0]).toMatchObject({ status: "sent", attempts: 1, lastStatus: 200 });
    expect(await dispatch()).toMatchObject({ claimed: 0 });
    expect(fake.requests).toHaveLength(1);
  });

  it("OpenAI (القرار 91): order_created بالمعرّف نفسه والمفتاح في الترويسة وحدها", async () => {
    await enable("openai");
    const orderId = await paidOrder();
    expect(await dispatch()).toMatchObject({ claimed: 1, sent: 1 });
    const request = fake.requests[0];
    expect(request?.url).toBe("https://bzr.openai.com/v1/events?pid=1345349876");
    expect(request?.headers.Authorization).toBe("Bearer openai-server-token");
    expect(JSON.parse(request?.body ?? "{}")).toMatchObject({
      validate_only: false,
      events: [{ id: `purchase.${orderId}`, type: "order_created", data: { amount: PRICE } }],
    });
    expect((await rows("openai"))[0]).toMatchObject({ status: "sent", eventName: "purchase" });
  });

  it("503 يُعاد بعد دقيقة، و400 يموت، والميت لا يُرسل ثانية", async () => {
    await enable("meta");
    await paidOrder();
    fake.respondWith({ kind: "response", status: 503, body: "" });
    expect(await dispatch()).toMatchObject({ retried: 1 });
    expect(await dispatch(new Date(now.getTime() + 30_000))).toMatchObject({ claimed: 0 });
    fake.respondWith({ kind: "response", status: 400, body: '{"error":{}}' });
    expect(await dispatch(new Date(now.getTime() + 61_000))).toMatchObject({ dead: 1 });
    expect((await rows("meta"))[0]).toMatchObject({
      status: "dead",
      attempts: 2,
      lastReason: "http_400",
    });
    expect(await dispatch(new Date(now.getTime() + 86_400_000))).toMatchObject({ claimed: 0 });
  });

  it("أُطفئت المنصة بعد الإدراج ⇒ تخطٍّ بلا إرسال، وGA4 بلا _ga ⇒ تخطٍّ", async () => {
    await enable("meta");
    await enable("ga4");
    await paidOrder(null);
    unwrap(
      await saveIntegration(db, {
        clubId,
        provider: "meta",
        enabled: false,
        config: CONFIG.meta,
        testEventCode: null,
        secret: { kind: "keep" },
        staffId,
        actor: `staff:${staffId}`,
        now,
      }),
    );
    expect(await dispatch()).toMatchObject({ claimed: 2, skipped: 2 });
    expect(fake.requests).toEqual([]);
    expect((await rows("meta"))[0]?.lastReason).toBe("disabled");
    expect((await rows("ga4"))[0]?.lastReason).toBe("no_client_id");
  });

  it("مفتاح لوحة آخر لا يفك المفتاح ⇒ تخطٍّ", async () => {
    await enable("meta");
    await paidOrder();
    const other = new Uint8Array(32).fill(9);
    const summary = await runDispatch({
      db,
      transport: fake.transport,
      adminKey: other,
      siteUrl: SITE,
      clock: () => now,
    });
    expect(summary).toMatchObject({ skipped: 1 });
    expect((await rows("meta"))[0]?.lastReason).toBe("secret_unreadable");
  });

  it("طلب سُوّي بعد تفريغ قياسه: يموت retention_purged بلا إرسال (القرار 90-6)", async () => {
    await enable("meta");
    // الطلب وختمه في وقت الاختبار الثابت (قبل أكثر من 90 يومًا)، ففُرِّغ قبل أن يُدفع الآن
    const purge = () => purgeExpiredTracking(db, { now, batchSize: 10, maxBatches: 1 });
    await paidOrder("123.456", purge, TEST_NOW);
    expect(await rows("meta")).toHaveLength(1);
    expect(await dispatch()).toMatchObject({ claimed: 1, dead: 1 });
    expect(fake.requests).toHaveLength(0);
    expect((await rows("meta"))[0]).toMatchObject({ status: "dead", lastReason: PURGE_REASON });
  });
});

describe("استثناء في حدث واحد", () => {
  it("لا يوقف الدفعة: يُسجَّل internal_error إعادةً، والرمي الثابت يموت بعد أقصى المحاولات", async () => {
    await enable("meta");
    await enable("ga4");
    await paidOrder();
    const throwing = (request: { url: string }) =>
      request.url.includes("facebook")
        ? Promise.reject(new Error("boom"))
        : fake.transport({ url: request.url, headers: {}, body: "" });
    const run = (at: Date) =>
      runDispatch({ db, transport: throwing, adminKey: KEY, siteUrl: SITE, clock: () => at });
    expect(await run(now)).toMatchObject({ claimed: 2, sent: 1, retried: 1 });
    expect((await rows("meta"))[0]).toMatchObject({
      status: "pending",
      attempts: 1,
      lastReason: "internal_error",
    });
    for (let attempt = 2; attempt <= MAX_DELIVERY_ATTEMPTS; attempt += 1) {
      await run(new Date(now.getTime() + attempt * 13 * 3_600_000));
    }
    expect((await rows("meta"))[0]).toMatchObject({ status: "dead", lastReason: "internal_error" });
  });
});

describe("حدث الاختبار", () => {
  const deps = () => ({
    db,
    transport: fake.transport,
    adminKey: KEY,
    siteUrl: SITE,
    clock: () => now,
  });

  it("ميتا بلا رمز اختبار لا ترسل، ومعه ترسل وتُسجَّل", async () => {
    await enable("meta");
    expect(await sendTestEvent(deps(), clubId, "meta")).toEqual({
      kind: "not_sent",
      reason: "no_test_event_code",
    });
    await enable("meta", { testCode: "TEST123" });
    expect(await sendTestEvent(deps(), clubId, "meta")).toEqual({ kind: "sent", status: 200 });
    expect(JSON.parse(fake.requests[0]?.body ?? "{}")).toMatchObject({
      test_event_code: "TEST123",
    });
    const [row] = await db.trackingOutbox.findMany({ where: { kind: "test" } });
    expect(row).toMatchObject({
      provider: "meta",
      status: "sent",
      eventName: "MasarTestEvent",
      orderId: null,
    });
  });

  it("رفض المنصة يُسجَّل برمزه", async () => {
    await enable("ga4");
    fake.respondWith({ kind: "response", status: 200, body: '{"validationMessages":[{"x":1}]}' });
    expect(await sendTestEvent(deps(), clubId, "ga4")).toEqual({
      kind: "failed",
      status: 200,
      reason: "validation_failed",
    });
    expect(fake.requests[0]?.url).toContain("/debug/mp/collect?");
    await enable("openai");
    expect(await sendTestEvent(deps(), clubId, "openai")).toEqual({ kind: "sent", status: 200 });
    expect(JSON.parse(fake.requests[1]?.body ?? "{}")).toMatchObject({ validate_only: true });
  });
});
