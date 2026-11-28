import { CONSENT_VERSION } from "@masar/domain";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createDb,
  createOrder,
  listIntegrations,
  loadPurchaseContext,
  markOrderPaid,
  recordOrderTracking,
  saveIntegration,
  type Db,
  type SaveIntegrationInput,
} from "./index";
import { createPlan, createTestClub, type TestProduct } from "./test-support/commerce-fixtures";
import { orderInput, testDatabaseUrl, unwrap } from "./test-support/commerce-orders";
import { resetCommerceTables } from "./test-support/reset-database";
import { createTestStaff } from "./test-support/staff-fixtures";

/** مراجعة القرار 91: تأكيد المطابقة المتقدمة الآلية في الإعداد والتدقيق (M1)، وكوكي __oppref (L1). */
const PRICE = 60_000;
const SEALED = "v1.aXY.dGFn.Y2lwaGVy";
const OPPREF = "op/pref+cookie=~é";

let db: Db;
let clubId: string;
let staffId: string;
let plan: TestProduct;

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
});

afterAll(async () => {
  await resetCommerceTables(db);
  await db.$disconnect();
});

function openai(aamDisabled: boolean): SaveIntegrationInput {
  return {
    clubId,
    provider: "openai",
    enabled: true,
    config: { pixelId: "1345349876", sendHashedPhone: true, aamDisabled },
    testEventCode: null,
    secret: { kind: "set", sealed: SEALED, last4: "abcd" },
    staffId,
    actor: `staff:${staffId}`,
    now: new Date(),
  };
}

async function trackedOrder(oppref: string | null): Promise<string> {
  const { orderId } = unwrap(await createOrder(db, orderInput(plan.slug, PRICE)));
  await recordOrderTracking(db, {
    orderId,
    consent: { analytics: false, ads: true, version: CONSENT_VERSION, at: new Date() },
    firstTouch: null,
    lastTouch: null,
    gaClientId: null,
    fbp: null,
    fbc: null,
    scid: null,
    ttp: null,
    obref: null,
    oppref,
    clientIp: null,
    userAgent: null,
    pageUrl: null,
    now: new Date(),
  });
  return orderId;
}

describe("OpenAI: تأكيد إطفاء المطابقة المتقدمة الآلية", () => {
  it("يُحفظ ويُقرأ، وتغييره يظهر باسمه في التدقيق", async () => {
    unwrap(await saveIntegration(db, openai(false)));
    unwrap(await saveIntegration(db, { ...openai(true), secret: { kind: "keep" } }));
    expect((await listIntegrations(db, clubId))[0]?.config).toEqual({
      pixelId: "1345349876",
      sendHashedPhone: true,
      aamDisabled: true,
    });
    const audit = await db.auditLog.findMany({
      where: { entityType: "tracking_integration" },
      orderBy: { createdAt: "asc" },
    });
    expect(audit[1]?.data).toMatchObject({ platform: "openai", changed: "aamDisabled" });
  });
});

describe("OpenAI: كوكي __oppref مع الطلب", () => {
  it("يُختم بمحارفه كما هي ويصل الباني، والقاعدة ترفض محرف تحكم وما فوق 512", async () => {
    const orderId = await trackedOrder(OPPREF);
    unwrap(
      await markOrderPaid(db, {
        orderId,
        payment: {
          provider: "test_pay",
          providerPaymentId: "p1",
          amountMinor: PRICE,
          currency: "SAR",
        },
        actor: "provider",
        now: new Date(),
      }),
    );
    expect((await loadPurchaseContext(db, orderId))?.opprefCookie).toBe(OPPREF);
    await expect(trackedOrder("a\u0001b")).rejects.toThrow(/order_tracking_oppref_shape/);
    await expect(trackedOrder("x".repeat(513))).rejects.toThrow(/order_tracking_oppref_shape/);
  });
});
