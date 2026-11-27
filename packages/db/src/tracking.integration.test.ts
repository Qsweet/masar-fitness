import { randomUUID } from "node:crypto";
import { CONSENT_VERSION, type VerifiedPayment } from "@masar/domain";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  claimDueEvents,
  createDb,
  createOrder,
  listIntegrations,
  listRecentTrackingEvents,
  loadPurchaseContext,
  loadSendableIntegration,
  markOrderPaid,
  recordAttempt,
  recordOrderTracking,
  recordTestEvent,
  saveIntegration,
  type Db,
  type OrderTrackingInput,
  type SaveIntegrationInput,
} from "./index";
import { createPlan, createTestClub, type TestProduct } from "./test-support/commerce-fixtures";
import { orderInput, testDatabaseUrl, unwrap } from "./test-support/commerce-orders";
import { resetCommerceTables } from "./test-support/reset-database";
import { createTestStaff } from "./test-support/staff-fixtures";

const PRICE = 60_000;
const PAID_AT = new Date("2026-11-20T09:00:00Z");
/** مفتاح مختوم بشكل sealSecret: القاعدة تفحص الشكل لا المعنى. */
const SEALED = "v1.aXY.dGFn.Y2lwaGVy";

let db: Db;
let clubId: string;
let staffId: string;
let plan: TestProduct;

beforeAll(async () => {
  db = createDb(testDatabaseUrl());
  await resetCommerceTables(db);
  clubId = await createTestClub(db);
  staffId = (await createTestStaff(db, clubId, { role: "owner" })).id;
  plan = await createPlan(db, clubId, { priceMinor: PRICE, durationMonths: 3, bonusMonths: 0 });
});

beforeEach(async () => {
  await db.$executeRaw`TRUNCATE tracking_outbox, order_tracking, tracking_integrations, audit_logs,
    memberships, order_discounts, order_items, orders, customers CASCADE`;
});

afterAll(async () => {
  await resetCommerceTables(db);
  await db.$disconnect();
});

function integration(overrides: Partial<SaveIntegrationInput> = {}): SaveIntegrationInput {
  return {
    clubId,
    provider: "meta",
    enabled: true,
    config: { pixelId: "123456789012345" },
    testEventCode: null,
    secret: { kind: "set", sealed: SEALED, last4: "abcd" },
    staffId,
    actor: `staff:${staffId}`,
    now: new Date(),
    ...overrides,
  };
}

function tracking(
  orderId: string,
  overrides: Partial<OrderTrackingInput> = {},
): OrderTrackingInput {
  return {
    orderId,
    consent: { analytics: true, ads: true, version: CONSENT_VERSION, at: new Date() },
    firstTouch: { values: { fbclid: "IwAR2F4" }, at: 1 },
    lastTouch: { values: { ttclid: "E.C.P.abc" }, at: 2 },
    gaClientId: "123.456",
    fbp: "fb.1.1700000000000.123",
    fbc: null,
    scid: null,
    ttp: null,
    clientIp: "203.0.113.9",
    userAgent: "Mozilla/5.0",
    pageUrl: "https://example.test/checkout",
    now: new Date(),
    ...overrides,
  };
}

function payment(): VerifiedPayment {
  return {
    provider: "test_pay",
    providerPaymentId: randomUUID(),
    amountMinor: PRICE,
    currency: "SAR",
  };
}

async function newOrder(): Promise<string> {
  return unwrap(await createOrder(db, orderInput(plan.slug, PRICE))).orderId;
}

async function outboxFor(orderId: string) {
  return db.trackingOutbox.findMany({ where: { orderId }, orderBy: { provider: "asc" } });
}

describe("إعداد المنصة", () => {
  it("يحفظ بسطر تدقيق بلا قيمة سرية، والمفتاح يُقرأ للمرسِل وحده", async () => {
    unwrap(await saveIntegration(db, integration()));
    const [view] = await listIntegrations(db, clubId);
    expect(view).toMatchObject({ provider: "meta", enabled: true, secretLast4: "abcd" });
    expect(view).not.toHaveProperty("secretEnc");
    expect(await loadSendableIntegration(db, clubId, "meta")).toMatchObject({ secretEnc: SEALED });
    const audit = await db.auditLog.findMany({ where: { entityType: "tracking_integration" } });
    expect(audit).toHaveLength(1);
    expect(JSON.stringify(audit[0]?.data)).not.toContain(SEALED);
    expect(JSON.stringify(audit[0]?.data)).not.toContain("abcd");
    expect(audit[0]?.data).toMatchObject({
      provider: "meta",
      fields: "pixelId",
      secretChanged: true,
    });
  });

  it("«أبقِ» لا يمس المفتاح، و«احذف» يحذفه، وبلا فرق لا كتابة", async () => {
    unwrap(await saveIntegration(db, integration()));
    expect(unwrap(await saveIntegration(db, integration({ secret: { kind: "keep" } })))).toEqual({
      changed: false,
    });
    unwrap(await saveIntegration(db, integration({ enabled: false, secret: { kind: "keep" } })));
    expect((await listIntegrations(db, clubId))[0]).toMatchObject({
      enabled: false,
      secretLast4: "abcd",
    });
    unwrap(await saveIntegration(db, integration({ secret: { kind: "clear" } })));
    expect((await listIntegrations(db, clubId))[0]?.secretLast4).toBeNull();
    expect(await db.auditLog.count({ where: { entityType: "tracking_integration" } })).toBe(3);
  });

  it("القاعدة ترفض منصة مجهولة ومفتاحًا بلا شكل", async () => {
    await expect(db.$executeRaw`
      INSERT INTO tracking_integrations (club_id, provider, updated_at)
      VALUES (${clubId}::uuid, 'myspace', now())`).rejects.toThrow();
    await expect(db.$executeRaw`
      INSERT INTO tracking_integrations (club_id, provider, secret_enc, secret_last4, updated_at)
      VALUES (${clubId}::uuid, 'meta', 'plain-token', 'oken', now())`).rejects.toThrow();
  });
});

describe("ختم الطلب", () => {
  it("يُدرج مرة، والثاني بلا أثر، والتعديل ممنوع", async () => {
    const orderId = await newOrder();
    expect(await recordOrderTracking(db, tracking(orderId))).toBe(true);
    expect(await recordOrderTracking(db, tracking(orderId, { gaClientId: "9.9" }))).toBe(false);
    expect((await db.orderTracking.findUniqueOrThrow({ where: { orderId } })).gaClientId).toBe(
      "123.456",
    );
    await expect(
      db.$executeRaw`UPDATE order_tracking SET fbp = NULL WHERE order_id = ${orderId}::uuid`,
    ).rejects.toThrow(/order_tracking_immutable/);
  });
});

describe("التحويل في معاملة التسوية", () => {
  async function enableAll(): Promise<void> {
    for (const provider of ["ga4", "meta", "snap", "tiktok", "google_ads"] as const) {
      unwrap(await saveIntegration(db, integration({ provider, config: {} })));
    }
  }

  it("سطر لكل منصة خادمية مفعّلة بمفتاح، مرة واحدة مهما تكرر الدفع", async () => {
    await enableAll();
    const orderId = await newOrder();
    await recordOrderTracking(db, tracking(orderId));
    const verified = payment();
    unwrap(
      await markOrderPaid(db, { orderId, payment: verified, actor: "provider", now: PAID_AT }),
    );
    unwrap(
      await markOrderPaid(db, { orderId, payment: verified, actor: "provider", now: PAID_AT }),
    );
    const rows = await outboxFor(orderId);
    expect(rows.map((row) => row.provider)).toEqual(["ga4", "meta", "snap", "tiktok"]);
    expect(new Set(rows.map((row) => row.eventId))).toEqual(new Set([`purchase.${orderId}`]));
    expect(
      rows.every(
        (row) => row.status === "pending" && row.eventTime.getTime() === PAID_AT.getTime(),
      ),
    ).toBe(true);
  });

  it("الموافقة المختومة تحكم: تحليلات بلا إعلانات ⇒ GA4 وحده، وبلا سطر قياس ⇒ لا شيء", async () => {
    await enableAll();
    const analyticsOnly = await newOrder();
    await recordOrderTracking(
      db,
      tracking(analyticsOnly, {
        consent: { analytics: true, ads: false, version: CONSENT_VERSION, at: new Date() },
      }),
    );
    unwrap(
      await markOrderPaid(db, {
        orderId: analyticsOnly,
        payment: payment(),
        actor: "provider",
        now: PAID_AT,
      }),
    );
    expect((await outboxFor(analyticsOnly)).map((row) => row.provider)).toEqual(["ga4"]);
    const untracked = await newOrder();
    unwrap(
      await markOrderPaid(db, {
        orderId: untracked,
        payment: payment(),
        actor: "provider",
        now: PAID_AT,
      }),
    );
    expect(await outboxFor(untracked)).toEqual([]);
  });

  it("المتوقفة أو بلا مفتاح لا تُدرج", async () => {
    unwrap(await saveIntegration(db, integration({ provider: "meta", enabled: false })));
    unwrap(await saveIntegration(db, integration({ provider: "snap", secret: { kind: "keep" } })));
    const orderId = await newOrder();
    await recordOrderTracking(db, tracking(orderId));
    unwrap(
      await markOrderPaid(db, { orderId, payment: payment(), actor: "provider", now: PAID_AT }),
    );
    expect(await outboxFor(orderId)).toEqual([]);
  });

  it("سياق الشراء من الطلب المدفوع ولقطته", async () => {
    await enableAll();
    const orderId = await newOrder();
    expect(await loadPurchaseContext(db, orderId)).toBeNull();
    await recordOrderTracking(db, tracking(orderId));
    unwrap(
      await markOrderPaid(db, { orderId, payment: payment(), actor: "provider", now: PAID_AT }),
    );
    const context = await loadPurchaseContext(db, orderId);
    expect(context).toMatchObject({
      orderId,
      totalMinor: PRICE,
      currency: "SAR",
      paidAt: PAID_AT,
      lastTouch: { values: { ttclid: "E.C.P.abc" }, at: 2 },
      items: [{ slug: plan.slug, totalMinor: PRICE }],
    });
    expect(context?.phoneE164).toMatch(/^\+9665\d{8}$/);
  });
});

describe("الطابور", () => {
  async function pendingOrder(): Promise<string> {
    unwrap(await saveIntegration(db, integration()));
    const orderId = await newOrder();
    await recordOrderTracking(db, tracking(orderId));
    unwrap(
      await markOrderPaid(db, { orderId, payment: payment(), actor: "provider", now: PAID_AT }),
    );
    return orderId;
  }

  it("الحجز يأخذ ما حان وقته مرة، والحجز الثاني لا يراه قبل المهلة", async () => {
    await pendingOrder();
    const now = new Date(PAID_AT.getTime() + 1_000);
    const [first, second] = await Promise.all([
      claimDueEvents(db, now, 10),
      claimDueEvents(db, now, 10),
    ]);
    expect(first.length + second.length).toBe(1);
    expect(await claimDueEvents(db, new Date(now.getTime() + 301_000), 10)).toHaveLength(1);
  });

  it("الإعادة ثم الإرسال، والميت لا يعود، والتخطي لا يُعدّ محاولة", async () => {
    const orderId = await pendingOrder();
    const [event] = await claimDueEvents(db, PAID_AT, 10);
    const id = event?.id ?? "";
    const retryAt = new Date(PAID_AT.getTime() + 60_000);
    await recordAttempt(
      db,
      id,
      { kind: "retry", at: retryAt, status: 503, reason: "http_503" },
      PAID_AT,
    );
    expect((await outboxFor(orderId))[0]).toMatchObject({
      status: "pending",
      attempts: 1,
      lastStatus: 503,
    });
    await recordAttempt(db, id, { kind: "sent", status: 200 }, retryAt);
    expect((await outboxFor(orderId))[0]).toMatchObject({
      status: "sent",
      attempts: 2,
      lastReason: null,
    });
    await recordAttempt(db, id, { kind: "dead", status: 400, reason: "http_400" }, retryAt);
    expect((await outboxFor(orderId))[0]?.status).toBe("sent");
    expect(await claimDueEvents(db, new Date(retryAt.getTime() + 600_000), 10)).toEqual([]);
  });

  it("حدث الاختبار يُسجَّل بلا طلب، والسجل بمرجع الطلب للحي", async () => {
    const orderId = await pendingOrder();
    await recordTestEvent(db, {
      clubId,
      provider: "meta",
      eventName: "MasarTestEvent",
      eventId: "test.1",
      delivered: false,
      status: 401,
      reason: "http_401",
      now: new Date(PAID_AT.getTime() + 1),
    });
    const rows = await listRecentTrackingEvents(db, clubId, 10);
    expect(rows.map((row) => [row.kind, row.status, row.lastStatus])).toEqual([
      ["test", "dead", 401],
      ["live", "pending", null],
    ]);
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(rows[1]?.orderReference).toBe(order.reference);
  });
});
