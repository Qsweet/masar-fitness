import { randomUUID } from "node:crypto";
import { plainDate, type ManualPaymentDetails } from "@masar/domain";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createDb,
  createOrder,
  expireDueOrders,
  getOrderDetail,
  recordManualPayment,
  type Db,
  type RecordManualPaymentInput,
} from "./index";
import {
  createPlan,
  createTestClub,
  TEST_NOW,
  type TestProduct,
} from "./test-support/commerce-fixtures";
import {
  failure,
  orderInput,
  testBuyer,
  testDatabaseUrl,
  testPhone,
  unwrap,
} from "./test-support/commerce-orders";
import {
  applyTestSnapshot,
  openTestAttempt,
  paymentSnapshot,
  sessionSnapshot,
} from "./test-support/payments-fixtures";
import { resetCommerceTables } from "./test-support/reset-database";
import { createTestStaff, type TestStaff } from "./test-support/staff-fixtures";

const PLAN_PRICE = 90_000;
const MINUTE_MS = 60_000;
const AFTER_WINDOW = new Date(TEST_NOW.getTime() + 31 * MINUTE_MS);
const DETAILS: ManualPaymentDetails = {
  method: "bank_transfer",
  externalReference: "TRF-1001",
  receivedOn: plainDate(2026, 6, 15),
  note: "وصلت الحوالة صباحًا",
};

let db: Db;
let clubId: string;
let otherClubId: string;
let plan: TestProduct;
let staff: TestStaff;
let phoneIndex = 0;
let referenceIndex = 0;

beforeAll(async () => {
  db = createDb(testDatabaseUrl());
  await resetCommerceTables(db);
  clubId = await createTestClub(db);
  otherClubId = await createTestClub(db);
  plan = await createPlan(db, clubId, { priceMinor: PLAN_PRICE, durationMonths: 3 });
  staff = await createTestStaff(db, clubId, { role: "manager" });
});

beforeEach(async () => {
  await db.$executeRaw`
    TRUNCATE audit_logs, memberships, order_discounts, order_items, orders, customers CASCADE`;
});

afterAll(async () => {
  await resetCommerceTables(db);
  await db.$disconnect();
});

async function newOrder(): Promise<string> {
  phoneIndex += 1;
  const input = orderInput(plan.slug, PLAN_PRICE, { buyer: testBuyer(testPhone(phoneIndex)) });
  return unwrap(await createOrder(db, input)).orderId;
}

/** مدخل صالح بمرجع خارجي فريد، يُغيَّر منه ما يلزم الاختبار. */
function input(
  orderId: string,
  overrides: Partial<RecordManualPaymentInput> = {},
): RecordManualPaymentInput {
  referenceIndex += 1;
  return {
    paymentId: randomUUID(),
    orderId,
    clubId,
    details: { ...DETAILS, externalReference: `TRF-${String(referenceIndex)}` },
    amountMinor: PLAN_PRICE,
    currency: "SAR",
    staffId: staff.id,
    now: TEST_NOW,
    ...overrides,
  };
}

function orderRow(orderId: string) {
  return db.order.findUniqueOrThrow({ where: { id: orderId } });
}

/** أفعال التدقيق مرتبة أبجديًا: سطور اللحظة الواحدة لا ترتيب زمني بينها. */
async function actions(): Promise<string[]> {
  const rows = await db.auditLog.findMany({ where: { action: { not: "order_created" } } });
  return rows.map((row) => row.action).sort();
}

async function expectUntouched(orderId: string): Promise<void> {
  expect((await orderRow(orderId)).status).toBe("pending_payment");
  expect(await db.manualPayment.count()).toBe(0);
  expect(await db.membership.count()).toBe(0);
  expect(await actions()).toEqual([]);
}

describe("recordManualPayment: الرفض بلا أثر", () => {
  it("مبلغ لا يساوي الإجمالي بالهللة، أو عملة أخرى", async () => {
    const orderId = await newOrder();
    for (const amountMinor of [PLAN_PRICE - 1, PLAN_PRICE + 1, 1]) {
      const result = await recordManualPayment(db, input(orderId, { amountMinor }));
      expect(failure(result)).toMatchObject({ reason: "payment.amount_mismatch" });
    }
    const currency = await recordManualPayment(db, input(orderId, { currency: "USD" }));
    expect(failure(currency)).toMatchObject({ reason: "payment.currency_mismatch" });
    await expectUntouched(orderId);
  });

  it("بلغ مهلته ولم يُكتب منتهيًا: order.payment_window_passed", async () => {
    const orderId = await newOrder();
    const late = await recordManualPayment(db, input(orderId, { now: AFTER_WINDOW }));
    expect(failure(late)).toMatchObject({ reason: "order.payment_window_passed" });
    await expectUntouched(orderId);
  });

  it("منتهٍ مكتوب: order.not_payable، ولا يُحيا", async () => {
    const orderId = await newOrder();
    expect(await expireDueOrders(db, { now: AFTER_WINDOW, limit: 10 })).toBe(1);
    const result = await recordManualPayment(db, input(orderId));
    expect(failure(result)).toMatchObject({ reason: "order.not_payable" });
    expect((await orderRow(orderId)).status).toBe("expired");
    expect(await db.manualPayment.count()).toBe(0);
  });

  it("محاولة دفع حيّة: مرفوض، ومقبول بعد نهايتها", async () => {
    const orderId = await newOrder();
    const attempt = await openTestAttempt(db, orderId);
    const blocked = await recordManualPayment(db, input(orderId));
    expect(failure(blocked)).toMatchObject({ reason: "order.settle_blocked_by_live_attempt" });
    expect((await orderRow(orderId)).status).toBe("pending_payment");
    const closed = sessionSnapshot(attempt, [], { state: "closed", rawStatus: "expired" });
    await applyTestSnapshot(db, attempt, closed, TEST_NOW);
    expect(unwrap(await recordManualPayment(db, input(orderId))).status).toBe("fulfilled");
  });

  it("طلب من نادٍ آخر: not_found", async () => {
    const orderId = await newOrder();
    const result = await recordManualPayment(db, input(orderId, { clubId: otherClubId }));
    expect(failure(result)).toMatchObject({ code: "not_found", reason: "order.not_found" });
    await expectUntouched(orderId);
  });
});

describe("recordManualPayment: نص حر لا يُسقط القاعدة", () => {
  it("ملاحظة فيها NUL ومحارف تحكم وعلامات اتجاه: تُسجَّل منظَّفة، لا عطل", async () => {
    const orderId = await newOrder();
    const note = "وصل\u0000 المبلغ\u0007\u202E\nسطر ثانٍ";
    const paid = await recordManualPayment(db, input(orderId, { details: { ...DETAILS, note } }));
    expect(unwrap(paid).status).toBe("fulfilled");
    const stored = await db.manualPayment.findFirstOrThrow({ where: { orderId } });
    expect(stored.note).toBe("وصل المبلغ\nسطر ثانٍ");
    const empty = await newOrder();
    const blank = { ...DETAILS, externalReference: "NUL-ONLY-1", note: "\u0000\u0000" };
    unwrap(await recordManualPayment(db, input(empty, { details: blank })));
    expect(
      (await db.manualPayment.findFirstOrThrow({ where: { orderId: empty } })).note,
    ).toBeNull();
  });
});

describe("يدوي ثم دفعة مزوّد متأخرة", () => {
  it("لقطة مدفوعة على محاولة قديمة: حادثة order_already_paid بلا اشتراك ثانٍ ولا تغيير في الطلب", async () => {
    const orderId = await newOrder();
    const attempt = await openTestAttempt(db, orderId);
    const closed = sessionSnapshot(attempt, [], { state: "closed", rawStatus: "expired" });
    await applyTestSnapshot(db, attempt, closed, TEST_NOW);
    const request = input(orderId);
    unwrap(await recordManualPayment(db, request));

    const late = sessionSnapshot(attempt, [paymentSnapshot(attempt, "paid")]);
    const outcome = await applyTestSnapshot(db, attempt, late, AFTER_WINDOW);
    expect(outcome.settlement).toBe("order.already_paid");

    expect(await db.membership.count({ where: { orderId } })).toBe(1);
    expect(await orderRow(orderId)).toMatchObject({
      status: "fulfilled",
      paidProvider: "manual",
      paidProviderPaymentId: request.paymentId,
      paidAt: TEST_NOW,
    });
    const incidents = await db.paymentIncident.findMany({ where: { orderId } });
    expect(incidents.map((incident) => incident.kind)).toEqual(["order_already_paid"]);
    // إعادة الإشعار نفسه لا تفتح حادثة ثانية ولا تفعّل
    await applyTestSnapshot(db, attempt, late, new Date(AFTER_WINDOW.getTime() + MINUTE_MS));
    expect(await db.paymentIncident.count({ where: { orderId } })).toBe(1);
    expect(await db.membership.count()).toBe(1);
    const detail = await getOrderDetail(db, clubId, orderId, AFTER_WINDOW);
    expect(detail?.incidents.map((incident) => incident.kind)).toEqual(["order_already_paid"]);
    expect(detail?.attempts).toHaveLength(1);
  });

  it("بعد التسجيل اليدوي لا تبدأ محاولة دفع جديدة (T8)", async () => {
    const orderId = await newOrder();
    unwrap(await recordManualPayment(db, input(orderId)));
    await expect(openTestAttempt(db, orderId)).rejects.toThrow();
    expect(await db.paymentAttempt.count({ where: { orderId } })).toBe(0);
  });
});
