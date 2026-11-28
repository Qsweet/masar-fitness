import { randomUUID } from "node:crypto";
import { CONSENT_VERSION } from "@masar/domain";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  claimBrowserPurchase,
  claimDueEvents,
  createDb,
  createOrder,
  listRecentTrackingEvents,
  markOrderPaid,
  recordAttempt,
  recordOrderTracking,
  recordTestEvent,
  saveIntegration,
  type ClaimedEvent,
  type Db,
} from "./index";
import { createPlan, createTestClub, type TestProduct } from "./test-support/commerce-fixtures";
import { orderInput, testDatabaseUrl, unwrap } from "./test-support/commerce-orders";
import { resetCommerceTables } from "./test-support/reset-database";
import { createTestStaff } from "./test-support/staff-fixtures";

/** طابور التحويلات: الحجز برمز ومهلة، وتسجيل النتيجة بالرمز وحده، وسجل اللوحة، وأول عرض للشراء. */
const PRICE = 60_000;
const PAID_AT = new Date("2026-11-20T09:00:00Z");
const LEASE_MS = 900_000;

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
  await db.$executeRaw`TRUNCATE tracking_browser_purchases, tracking_outbox, order_tracking,
    tracking_integrations, audit_logs, memberships, order_discounts, order_items, orders, customers CASCADE`;
});

afterAll(async () => {
  await resetCommerceTables(db);
  await db.$disconnect();
});

async function pendingOrder(): Promise<string> {
  unwrap(
    await saveIntegration(db, {
      clubId,
      provider: "meta",
      enabled: true,
      config: { pixelId: "123456789012345" },
      testEventCode: null,
      secret: { kind: "set", sealed: "v1.aXY.dGFn.Y2lwaGVy", last4: "abcd" },
      staffId,
      actor: `staff:${staffId}`,
      now: new Date(),
    }),
  );
  const { orderId } = unwrap(await createOrder(db, orderInput(plan.slug, PRICE)));
  await recordOrderTracking(db, {
    orderId,
    consent: { analytics: true, ads: true, version: CONSENT_VERSION, at: new Date() },
    firstTouch: null,
    lastTouch: null,
    gaClientId: null,
    fbp: null,
    fbc: null,
    scid: null,
    ttp: null,
    obref: null,
    clientIp: null,
    userAgent: null,
    pageUrl: null,
    now: new Date(),
  });
  const payment = {
    provider: "test_pay",
    providerPaymentId: randomUUID(),
    amountMinor: PRICE,
    currency: "SAR",
  };
  unwrap(await markOrderPaid(db, { orderId, payment, actor: "provider", now: PAID_AT }));
  return orderId;
}

/** الحدث المحجوز برمزه، أو خطأ إن لم يُحجز شيء. */
function only(events: readonly ClaimedEvent[]): ClaimedEvent {
  const [event] = events;
  if (event === undefined) {
    throw new Error("لم يُحجز حدث");
  }
  return event;
}

function row(orderId: string) {
  return db.trackingOutbox.findFirstOrThrow({ where: { orderId } });
}

describe("الحجز برمز ومهلة", () => {
  it("مرسِلان معًا: واحد يأخذ السطر، والثاني لا يراه قبل المهلة", async () => {
    await pendingOrder();
    const now = new Date(PAID_AT.getTime() + 1_000);
    const [first, second] = await Promise.all([
      claimDueEvents(db, now, 10, LEASE_MS),
      claimDueEvents(db, now, 10, LEASE_MS),
    ]);
    expect(first.length + second.length).toBe(1);
    expect(
      await claimDueEvents(db, new Date(now.getTime() + LEASE_MS - 1_000), 10, LEASE_MS),
    ).toEqual([]);
  });

  it("مرسِل انقضت مهلته لا يكتب نتيجته فوق من أخذ السطر بعده", async () => {
    const orderId = await pendingOrder();
    const stale = only(await claimDueEvents(db, PAID_AT, 10, LEASE_MS));
    const later = new Date(PAID_AT.getTime() + LEASE_MS + 1_000);
    const fresh = only(await claimDueEvents(db, later, 10, LEASE_MS));
    expect(stale.claimToken).not.toBe(fresh.claimToken);
    expect(await recordAttempt(db, stale, { kind: "sent", status: 200 }, later)).toBe(false);
    expect((await row(orderId)).status).toBe("pending");
    expect(await recordAttempt(db, fresh, { kind: "sent", status: 200 }, later)).toBe(true);
    expect(await row(orderId)).toMatchObject({ status: "sent", attempts: 1, claimToken: null });
  });

  it("الإعادة ثم الإرسال، والميت لا يعود", async () => {
    const orderId = await pendingOrder();
    const claim = only(await claimDueEvents(db, PAID_AT, 10, LEASE_MS));
    const retryAt = new Date(PAID_AT.getTime() + 60_000);
    const retry = { kind: "retry", at: retryAt, status: 503, reason: "http_503" } as const;
    expect(await recordAttempt(db, claim, retry, PAID_AT)).toBe(true);
    expect(await row(orderId)).toMatchObject({ status: "pending", attempts: 1, lastStatus: 503 });
    // الرمز القديم بلا أثر بعد التسجيل: الحجز التالي برمز جديد
    expect(await recordAttempt(db, claim, { kind: "sent", status: 200 }, retryAt)).toBe(false);
    const next = only(await claimDueEvents(db, retryAt, 10, LEASE_MS));
    await recordAttempt(db, next, { kind: "dead", status: 400, reason: "http_400" }, retryAt);
    expect(await row(orderId)).toMatchObject({
      status: "dead",
      attempts: 2,
      lastReason: "http_400",
    });
    expect(
      await claimDueEvents(db, new Date(retryAt.getTime() + 86_400_000), 10, LEASE_MS),
    ).toEqual([]);
  });
});

describe("سجل اللوحة وأول عرض", () => {
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
    expect(rows.map((item) => [item.kind, item.status, item.lastStatus])).toEqual([
      ["test", "dead", 401],
      ["live", "pending", null],
    ]);
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(rows[1]?.orderReference).toBe(order.reference);
  });

  it("أول عرض للطلب المدفوع مرة واحدة، ولطلب مجهول لا شيء", async () => {
    const orderId = await pendingOrder();
    expect(await claimBrowserPurchase(db, orderId, PAID_AT)).toBe(true);
    expect(await claimBrowserPurchase(db, orderId, PAID_AT)).toBe(false);
    expect(await claimBrowserPurchase(db, randomUUID(), PAID_AT)).toBe(false);
  });
});
