import { randomUUID } from "node:crypto";
import { plainDate, type ManualPaymentDetails } from "@masar/domain";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createDb,
  createOrder,
  findManualReferenceUse,
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
  createDbClients,
  disconnectAll,
  failure,
  orderInput,
  testBuyer,
  testDatabaseUrl,
  testPhone,
  unwrap,
} from "./test-support/commerce-orders";
import { resetCommerceTables } from "./test-support/reset-database";
import { createTestStaff, type TestStaff } from "./test-support/staff-fixtures";

const PLAN_PRICE = 90_000;
const MINUTE_MS = 60_000;
const CLIENTS = 8;
const DETAILS: ManualPaymentDetails = {
  method: "bank_transfer",
  externalReference: "TRF-1001",
  receivedOn: plainDate(2026, 6, 15),
  note: "وصلت الحوالة صباحًا",
};

let db: Db;
let clients: Db[];
let clubId: string;
let otherClubId: string;
let plan: TestProduct;
let staff: TestStaff;
let phoneIndex = 0;
let referenceIndex = 0;

beforeAll(async () => {
  db = createDb(testDatabaseUrl());
  clients = createDbClients(CLIENTS);
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
  await disconnectAll(clients);
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

describe("recordManualPayment: النجاح", () => {
  it("طلب مسلَّم، واشتراك واحد يبدأ يوم التسجيل، وسطور التدقيق الأربعة بفاعلها", async () => {
    const orderId = await newOrder();
    const request = input(orderId, { details: DETAILS });
    const paid = unwrap(await recordManualPayment(db, request));
    expect(paid).toMatchObject({ orderId, status: "fulfilled", replayed: false });

    expect(await orderRow(orderId)).toMatchObject({
      status: "fulfilled",
      paidAt: TEST_NOW,
      paidProvider: "manual",
      paidProviderPaymentId: request.paymentId,
      paidAmountMinor: PLAN_PRICE,
      paidCurrency: "SAR",
    });
    const memberships = await db.membership.findMany({ where: { orderId } });
    expect(memberships).toHaveLength(1);
    expect(memberships[0]).toMatchObject({ id: paid.membershipId, status: "active" });
    // 09:00Z يوم 15 يونيو = 15 يونيو بتوقيت الرياض: يوم التسجيل لا يوم الاستلام
    expect(memberships[0]?.startsOn?.toISOString().slice(0, 10)).toBe("2026-06-15");

    expect(await actions()).toEqual([
      "manual_payment_recorded",
      "membership_created",
      "order_fulfilled",
      "payment_verified",
    ]);
    const audit = await db.auditLog.findMany({
      where: { action: { in: ["manual_payment_recorded", "payment_verified"] } },
    });
    expect(audit.map((row) => row.actor)).toEqual([`staff:${staff.id}`, `staff:${staff.id}`]);
    const recorded = audit.find((row) => row.action === "manual_payment_recorded");
    expect(recorded).toMatchObject({
      entityType: "manual_payment",
      entityId: request.paymentId,
      data: {
        orderId,
        method: "bank_transfer",
        externalReference: "TRF-1001",
        receivedOn: "2026-06-15",
        amountMinor: PLAN_PRICE,
        currency: "SAR",
      },
    });
    // الملاحظة نص حر: تبقى في جدولها ولا تدخل التدقيق
    expect(JSON.stringify(await db.auditLog.findMany())).not.toContain("وصلت الحوالة");
  });

  it("تفصيل الطلب يعرض الدفعة اليدوية ومسجِّلها والخط الزمني", async () => {
    const orderId = await newOrder();
    const request = input(orderId, { details: { ...DETAILS, method: "paid_at_club" } });
    unwrap(await recordManualPayment(db, request));
    const detail = await getOrderDetail(db, clubId, orderId, TEST_NOW);
    expect(detail?.payment).toMatchObject({ provider: "manual", paidAt: TEST_NOW });
    expect(detail?.manualPayment).toMatchObject({
      id: request.paymentId,
      method: "paid_at_club",
      receivedOn: plainDate(2026, 6, 15),
      note: "وصلت الحوالة صباحًا",
      recordedBy: staff.id,
    });
    expect(detail?.membership?.status).toBe("active");
    expect(detail?.timeline.map((entry) => entry.action).sort()).toEqual([
      "manual_payment_recorded",
      "membership_created",
      "order_created",
      "order_fulfilled",
      "payment_verified",
    ]);
  });
});

describe("recordManualPayment: عدم التكرار", () => {
  it("الإرسال الثاني بالمعرّف نفسه: النتيجة نفسها بلا أثر", async () => {
    const orderId = await newOrder();
    const request = input(orderId);
    const first = unwrap(await recordManualPayment(db, request));
    const again = unwrap(
      await recordManualPayment(db, { ...request, now: new Date(TEST_NOW.getTime() + MINUTE_MS) }),
    );
    expect(again).toEqual({ ...first, replayed: true });
    expect(await db.manualPayment.count()).toBe(1);
    expect(await db.membership.count()).toBe(1);
    expect(await actions()).toHaveLength(4);
    expect((await orderRow(orderId)).paidAt).toEqual(TEST_NOW);
  });

  it("معرّف آخر على طلب مدفوع: order.already_paid بلا أثر", async () => {
    const orderId = await newOrder();
    unwrap(await recordManualPayment(db, input(orderId)));
    const second = await recordManualPayment(db, input(orderId));
    expect(failure(second)).toMatchObject({ code: "conflict", reason: "order.already_paid" });
    expect(await db.manualPayment.count()).toBe(1);
    expect(await db.membership.count()).toBe(1);
    expect(await actions()).toHaveLength(4);
  });

  it("مرجع خارجي مستعمل لطلب آخر: مرفوض بأي طريقة، ويُعرف الطلب الذي استعمله", async () => {
    const first = await newOrder();
    const second = await newOrder();
    const details = { ...DETAILS, externalReference: "RCPT-77" };
    unwrap(await recordManualPayment(db, input(first, { details })));
    for (const method of ["bank_transfer", "paid_at_club"] as const) {
      const reused = await recordManualPayment(
        db,
        input(second, { details: { ...details, method } }),
      );
      expect(failure(reused)).toMatchObject({
        reason: "manual_payment.reference_used",
        field: "externalReference",
      });
    }
    expect((await orderRow(second)).status).toBe("pending_payment");
    expect(await db.manualPayment.count()).toBe(1);
    const use = await findManualReferenceUse(db, clubId, "rcpt 77");
    expect(use).toEqual({ orderId: first, orderReference: (await orderRow(first)).reference });
    expect(await findManualReferenceUse(db, clubId, "RCPT-78")).toBeUndefined();
    expect(await findManualReferenceUse(db, otherClubId, "RCPT-77")).toBeUndefined();
  });

  it.each([
    ["١٢٣٤٥٦", ["123456", "12 34 56", "123-456", "۱۲۳۴۵۶"]],
    ["trf-99", ["TRF-99", "TRF 99", "TRF\u201199", "TRF99", "ＴＲＦ－９９", "t.r.f/99"]],
  ])(
    "كتابات المرجع %s كلها مرجع واحد: طلب واحد يُسوّى والباقي يُرفض",
    async (original, variants) => {
      const first = await newOrder();
      unwrap(
        await recordManualPayment(
          db,
          input(first, { details: { ...DETAILS, externalReference: original } }),
        ),
      );
      for (const externalReference of variants) {
        const orderId = await newOrder();
        const details = { ...DETAILS, method: "paid_at_club", externalReference } as const;
        const reused = await recordManualPayment(db, input(orderId, { details }));
        expect(failure(reused), externalReference).toMatchObject({
          reason: "manual_payment.reference_used",
        });
        expect((await orderRow(orderId)).status).toBe("pending_payment");
      }
      expect(await db.manualPayment.count()).toBe(1);
      expect(await db.membership.count()).toBe(1);
      // ما كتبه الموظف محفوظ للعرض كما هو
      const stored = await db.manualPayment.findFirstOrThrow();
      expect(stored.externalReference).toBe(original);
    },
  );

  it("تسجيلان متزامنان بكتابتين للمرجع نفسه على طلبين: واحد فقط يُسوّى", async () => {
    const orders = [await newOrder(), await newOrder()];
    const results = await Promise.all(
      ["TRF-500", "trf 500"].map((externalReference, index) =>
        recordManualPayment(
          clients[index] ?? db,
          input(orders[index] ?? "", { details: { ...DETAILS, externalReference } }),
        ),
      ),
    );
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    const refused = results.find((result) => !result.ok);
    expect(refused === undefined ? null : failure(refused)).toMatchObject({
      reason: "manual_payment.reference_used",
    });
    expect(await db.manualPayment.count()).toBe(1);
    expect(await db.membership.count()).toBe(1);
  });

  it("معرّف دفعة سوّى طلبًا آخر: مرفوض بلا أثر على الطلب الثاني", async () => {
    const first = await newOrder();
    const second = await newOrder();
    const request = input(first);
    unwrap(await recordManualPayment(db, request));
    const stolen = await recordManualPayment(db, input(second, { paymentId: request.paymentId }));
    expect(stolen.ok).toBe(false);
    expect((await orderRow(second)).status).toBe("pending_payment");
    expect(await db.membership.count()).toBe(1);
  });

  it("ثمانية تسجيلات متزامنة بمعرّفات مختلفة على الطلب نفسه: واحد يفعّل والباقي order.already_paid", async () => {
    const orderId = await newOrder();
    const results = await Promise.all(
      clients.map((client) => recordManualPayment(client, input(orderId))),
    );
    const winners = results.filter((result) => result.ok);
    expect(winners).toHaveLength(1);
    for (const result of results.filter((entry) => !entry.ok)) {
      expect(failure(result)).toMatchObject({ reason: "order.already_paid" });
    }
    expect(await db.manualPayment.count()).toBe(1);
    expect(await db.membership.count()).toBe(1);
    expect(await actions()).toHaveLength(4);
  }, 30_000);

  it("ثمانية تسجيلات متزامنة بالمعرّف نفسه: تفعيل واحد والباقي إعادة", async () => {
    const orderId = await newOrder();
    const request = input(orderId);
    const results = await Promise.all(
      clients.map((client) => recordManualPayment(client, request)),
    );
    const paid = results.map((result) => unwrap(result));
    expect(paid.filter((result) => !result.replayed)).toHaveLength(1);
    expect(new Set(paid.map((result) => result.membershipId)).size).toBe(1);
    expect(await db.manualPayment.count()).toBe(1);
    expect(await db.membership.count()).toBe(1);
    expect(await actions()).toHaveLength(4);
  }, 30_000);
});
