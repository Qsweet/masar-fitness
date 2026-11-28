import { CONSENT_VERSION } from "@masar/domain";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createDb,
  createOrder,
  loadPurchaseContext,
  purgeExpiredTracking,
  PURGE_REASON,
  recordOrderTracking,
  type Db,
} from "./index";
import { TEST_NOW } from "./test-support/commerce-constants";
import { createPlan, createTestClub, type TestProduct } from "./test-support/commerce-fixtures";
import {
  orderInput,
  testBuyer,
  testDatabaseUrl,
  testPhone,
  unwrap,
} from "./test-support/commerce-orders";
import { resetCommerceTables } from "./test-support/reset-database";

/** القرار 90-6: التفريغ بعد 90 يومًا من إنشاء الطلب، بدفعات، والإعادة بلا أثر. */
const PRICE = 60_000;
const DAY_MS = 86_400_000;
const AFTER_RETENTION = new Date(TEST_NOW.getTime() + 91 * DAY_MS);
const BEFORE_RETENTION = new Date(TEST_NOW.getTime() + 89 * DAY_MS);

let db: Db;
let clubId: string;
let plan: TestProduct;
let buyers = 0;

beforeAll(async () => {
  db = createDb(testDatabaseUrl());
  await resetCommerceTables(db);
  clubId = await createTestClub(db);
  plan = await createPlan(db, clubId, { priceMinor: PRICE, durationMonths: 3, bonusMonths: 0 });
});

beforeEach(async () => {
  await db.$executeRaw`TRUNCATE tracking_outbox, order_tracking, tracking_browser_purchases,
    memberships, order_discounts, order_items, orders, customers CASCADE`;
});

afterAll(async () => {
  await resetCommerceTables(db);
  await db.$disconnect();
});

async function trackedOrder(): Promise<string> {
  buyers += 1;
  const buyer = testBuyer(testPhone(buyers));
  const { orderId } = unwrap(await createOrder(db, orderInput(plan.slug, PRICE, { buyer })));
  await recordOrderTracking(db, {
    orderId,
    consent: { analytics: true, ads: true, version: CONSENT_VERSION, at: TEST_NOW },
    firstTouch: {
      values: { utm_source: "snapchat", ScCid: "7b3a7917" },
      at: 1,
      landing: "/memberships",
    },
    lastTouch: { values: { twclid: "26ab3x9kq0", gclid: "Cj0KCQ" }, at: 2, landing: "/" },
    gaClientId: "123.456",
    fbp: "fb.1.1700000000000.123",
    fbc: "fb.1.1700000000000.IwAR",
    scid: "a1b2c3d4-e5f6",
    ttp: "ttp-value-1234",
    clientIp: "203.0.113.9",
    userAgent: "Mozilla/5.0",
    pageUrl: "https://example.test/checkout?fbclid=IwAR",
    now: TEST_NOW,
  });
  return orderId;
}

async function row(orderId: string) {
  return db.orderTracking.findUniqueOrThrow({ where: { orderId } });
}

const OPTIONS = { batchSize: 2, maxBatches: 10 } as const;

describe("تفريغ معرّفات القياس", () => {
  it("قبل 90 يومًا لا شيء، وبعدها تُصفَّر المعرّفات وتبقى الحملة وصفحة الهبوط والموافقة", async () => {
    const orderId = await trackedOrder();
    expect(await purgeExpiredTracking(db, { now: BEFORE_RETENTION, ...OPTIONS })).toEqual({
      orders: 0,
      outbox: 0,
    });
    expect((await row(orderId)).clientIp).toBe("203.0.113.9");

    expect(await purgeExpiredTracking(db, { now: AFTER_RETENTION, ...OPTIONS })).toEqual({
      orders: 1,
      outbox: 0,
    });
    const purged = await row(orderId);
    expect(purged).toMatchObject({
      gaClientId: null,
      fbp: null,
      fbc: null,
      scid: null,
      ttp: null,
      clientIp: null,
      userAgent: null,
      pageUrl: null,
      consentAds: true,
      consentAnalytics: true,
      purgedAt: AFTER_RETENTION,
    });
    expect(purged.firstTouch).toEqual({
      values: { utm_source: "snapchat" },
      at: 1,
      landing: "/memberships",
    });
    expect(purged.lastTouch).toEqual({ values: {}, at: 2, landing: "/" });
    expect(await loadPurchaseContext(db, orderId)).toBeNull(); // غير مدفوع؛ السطر نفسه يُقرأ
  });

  it("بالدفعات حتى يفرغ الكل، والإعادة لا تغيّر شيئًا", async () => {
    const ids = [await trackedOrder(), await trackedOrder(), await trackedOrder()];
    expect((await purgeExpiredTracking(db, { now: AFTER_RETENTION, ...OPTIONS })).orders).toBe(3);
    const again = await purgeExpiredTracking(db, {
      now: new Date(AFTER_RETENTION.getTime() + DAY_MS),
      ...OPTIONS,
    });
    expect(again.orders).toBe(0);
    for (const id of ids) {
      expect((await row(id)).purgedAt).toEqual(AFTER_RETENTION);
    }
    const capped = await trackedOrder();
    await purgeExpiredTracking(db, { now: AFTER_RETENTION, batchSize: 1, maxBatches: 0 });
    expect((await row(capped)).purgedAt).toBeNull();
  });

  it("الـtrigger يقبل التفريغ وحده: لا تعديل آخر ولا تفريغ ناقص ولا إعادة", async () => {
    const orderId = await trackedOrder();
    await expect(db.$executeRaw`
      UPDATE order_tracking SET consent_ads = false WHERE order_id = ${orderId}::uuid`).rejects.toThrow(
      "order_tracking_immutable",
    );
    await expect(db.$executeRaw`
      UPDATE order_tracking SET client_ip = NULL, purged_at = now()
      WHERE order_id = ${orderId}::uuid`).rejects.toThrow("order_tracking_immutable");
    await purgeExpiredTracking(db, { now: AFTER_RETENTION, ...OPTIONS });
    await expect(db.$executeRaw`
      UPDATE order_tracking SET purged_at = now() WHERE order_id = ${orderId}::uuid`).rejects.toThrow(
      "order_tracking_immutable",
    );
  });

  it("الطابور: المعلّق من العمر نفسه يُغلق بسببه، والمرسَل يبقى سجلًّا", async () => {
    const orderId = await trackedOrder();
    for (const [provider, status] of [
      ["meta", "pending"],
      ["snap", "sent"],
    ] as const) {
      await db.$executeRaw`
        INSERT INTO tracking_outbox (id, club_id, order_id, provider, event_name, event_id, kind,
          status, attempts, next_attempt_at, event_time, created_at, updated_at, claim_token)
        VALUES (gen_random_uuid(), ${clubId}::uuid, ${orderId}::uuid, ${provider}, 'purchase',
          ${`purchase.${orderId}`}, 'live', ${status}, 1, ${TEST_NOW}, ${TEST_NOW}, ${TEST_NOW},
          ${TEST_NOW}, gen_random_uuid())`;
    }
    expect((await purgeExpiredTracking(db, { now: AFTER_RETENTION, ...OPTIONS })).outbox).toBe(1);
    const rows = await db.trackingOutbox.findMany({
      where: { orderId },
      orderBy: { provider: "asc" },
    });
    expect(rows.map((item) => [item.provider, item.status, item.lastReason])).toEqual([
      ["meta", "dead", PURGE_REASON],
      ["snap", "sent", null],
    ]);
    expect(rows[0]?.claimToken).toBeNull();
  });
});
