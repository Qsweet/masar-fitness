import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDb, type Db } from "./index";
import {
  createPlan,
  createTestClub,
  expireRawOrder,
  insertRawOrder,
  markRawPaid,
  TEST_NOW,
  type RawOrder,
  type TestProduct,
} from "./test-support/commerce-fixtures";
import { testDatabaseUrl } from "./test-support/commerce-orders";
import { insertRawAttempt, setRawAttempt } from "./test-support/payments-fixtures";
import { resetCommerceTables } from "./test-support/reset-database";
import { createTestStaff, type TestStaff } from "./test-support/staff-fixtures";

/** سدود القاعدة للدفع اليدوي بـSQL خام: تختبر المحفّزات والقيود نفسها دون طبقة الكود. */
const PLAN_PRICE = 90_000;

let db: Db;
let clubId: string;
let otherClubId: string;
let plan: TestProduct;
let staff: TestStaff;
let order: RawOrder;

beforeAll(async () => {
  db = createDb(testDatabaseUrl());
  await resetCommerceTables(db);
  clubId = await createTestClub(db);
  otherClubId = await createTestClub(db);
  plan = await createPlan(db, clubId, { priceMinor: PLAN_PRICE, durationMonths: 1 });
  staff = await createTestStaff(db, clubId);
});

beforeEach(async () => {
  await db.$executeRaw`
    TRUNCATE audit_logs, memberships, order_discounts, order_items, orders, customers CASCADE`;
  order = await insertRawOrder(db, { clubId, lines: [{ product: plan }] });
});

afterAll(async () => {
  await resetCommerceTables(db);
  await db.$disconnect();
});

interface RawManual {
  id: string;
  clubId: string;
  orderId: string;
  method: string;
  reference: string;
  amountMinor: number;
  currency: string;
  note: string | null;
}

function manual(overrides: Partial<RawManual> = {}): RawManual {
  return {
    id: randomUUID(),
    clubId,
    orderId: order.orderId,
    method: "bank_transfer",
    reference: `REF-${randomUUID().slice(0, 8)}`,
    amountMinor: PLAN_PRICE,
    currency: "SAR",
    note: null,
    ...overrides,
  };
}

type Client = Pick<Db, "$executeRaw">;

function insertManual(client: Client, row: RawManual) {
  return client.$executeRaw`
    INSERT INTO manual_payments (id, club_id, order_id, method, external_reference, received_on,
      amount_minor, currency, note, recorded_by, created_at)
    VALUES (${row.id}::uuid, ${row.clubId}::uuid, ${row.orderId}::uuid, ${row.method},
      ${row.reference}, '2026-06-15'::date, ${row.amountMinor}, ${row.currency}, ${row.note},
      ${staff.id}::uuid, ${TEST_NOW})`;
}

function settleManually(client: Client, row: RawManual) {
  return client.$executeRaw`
    UPDATE orders SET status = 'paid', paid_at = ${TEST_NOW}, paid_provider = 'manual',
      paid_provider_payment_id = ${row.id}, paid_amount_minor = ${row.amountMinor},
      paid_currency = ${row.currency}
    WHERE id = ${row.orderId}::uuid`;
}

/** الصف والتسوية في معاملة واحدة، كما يفعل الكود. */
function insertAndSettle(row: RawManual) {
  return db.$transaction(async (tx) => {
    await insertManual(tx, row);
    await settleManually(tx, row);
  });
}

describe("T12: الدفعة اليدوية تطابق طلبًا معلّقًا", () => {
  it("طلب مدفوع أو منتهٍ: manual_payment_order_not_pending", async () => {
    await markRawPaid(db, order.orderId, { paidAt: TEST_NOW });
    await expect(insertAndSettle(manual())).rejects.toThrow("manual_payment_order_not_pending");
    const expired = await insertRawOrder(db, { clubId, lines: [{ product: plan }] });
    await expireRawOrder(db, expired.orderId);
    await expect(insertAndSettle(manual({ orderId: expired.orderId }))).rejects.toThrow(
      "manual_payment_order_not_pending",
    );
  });

  it("نادٍ أو مبلغ أو عملة لا تطابق اللقطة: manual_payment_snapshot_mismatch", async () => {
    for (const overrides of [
      { clubId: otherClubId },
      { amountMinor: PLAN_PRICE - 1 },
      { amountMinor: PLAN_PRICE + 1 },
      { currency: "USD" },
    ]) {
      await expect(insertAndSettle(manual(overrides))).rejects.toThrow(
        "manual_payment_snapshot_mismatch",
      );
    }
    expect(await db.manualPayment.count()).toBe(0);
  });

  it("محاولة دفع حيّة: manual_payment_blocked_by_live_attempt، ومقبول بعد نهايتها", async () => {
    const attempt = await insertRawAttempt(db, {
      clubId,
      orderId: order.orderId,
      amountMinor: PLAN_PRICE,
    });
    await expect(insertAndSettle(manual())).rejects.toThrow(
      "manual_payment_blocked_by_live_attempt",
    );
    await setRawAttempt(
      db,
      attempt.id,
      "status = 'failed', failure_reason = 'provider_unreachable', ended_at = now()",
    );
    await insertAndSettle(manual());
    expect(await db.manualPayment.count()).toBe(1);
  });

  it("الصف لا يُعدَّل ولا يُحذف", async () => {
    const row = manual();
    await insertAndSettle(row);
    const update = db.$executeRaw`UPDATE manual_payments SET note = 'x' WHERE id = ${row.id}::uuid`;
    await expect(update).rejects.toThrow("manual_payment_immutable");
    const remove = db.$executeRaw`DELETE FROM manual_payments WHERE id = ${row.id}::uuid`;
    await expect(remove).rejects.toThrow("manual_payment_immutable");
  });
});

describe("T13: لا صف يدوي بلا تسوية، ولا تسوية يدوية بلا صف", () => {
  it("صف بلا تسوية يُرفض عند COMMIT: manual_payment_requires_settlement", async () => {
    await expect(insertManual(db, manual())).rejects.toThrow("manual_payment_requires_settlement");
    expect(await db.manualPayment.count()).toBe(0);
  });

  it("صف والطلب سُوّي بدفعة أخرى في المعاملة نفسها: مرفوض", async () => {
    const row = manual();
    const mismatched = db.$transaction(async (tx) => {
      await insertManual(tx, row);
      await settleManually(tx, { ...row, id: randomUUID() });
    });
    await expect(mismatched).rejects.toThrow("order_manual_payment_missing");
    expect(await db.manualPayment.count()).toBe(0);
  });

  it("تسوية «manual» بلا صف: order_manual_payment_missing", async () => {
    await expect(settleManually(db, manual())).rejects.toThrow("order_manual_payment_missing");
    const row = await db.order.findUniqueOrThrow({ where: { id: order.orderId } });
    expect(row.status).toBe("pending_payment");
  });

  it("تسوية «manual» بمبلغ يخالف صفها: مرفوضة", async () => {
    const row = manual();
    const tampered = db.$transaction(async (tx) => {
      await insertManual(tx, row);
      await tx.$executeRaw`
        UPDATE orders SET status = 'paid', paid_at = ${TEST_NOW}, paid_provider = 'manual',
          paid_provider_payment_id = ${row.id}, paid_amount_minor = ${PLAN_PRICE - 1},
          paid_currency = 'SAR'
        WHERE id = ${row.orderId}::uuid`;
    });
    await expect(tampered).rejects.toThrow();
    expect(await db.manualPayment.count()).toBe(0);
  });

  it("تسوية مزوّد عادية لا يمسّها السدّ", async () => {
    await markRawPaid(db, order.orderId, { paidAt: TEST_NOW, provider: "test_pay" });
    const row = await db.order.findUniqueOrThrow({ where: { id: order.orderId } });
    expect(row.paidProvider).toBe("test_pay");
  });
});

describe("قيود manual_payments", () => {
  it.each([
    [{ method: "cash" }, "manual_payments_method_known"],
    [{ reference: "ab" }, "manual_payments_external_reference_shape"],
    [{ reference: " REF-1 " }, "manual_payments_external_reference_shape"],
    [{ reference: "x".repeat(65) }, "manual_payments_external_reference_shape"],
    [{ note: "" }, "manual_payments_note_length"],
    [{ note: "ن".repeat(501) }, "manual_payments_note_length"],
  ])("%o ⇒ %s", async (overrides, constraint) => {
    await expect(insertAndSettle(manual(overrides))).rejects.toThrow(constraint);
  });

  it("دفعة واحدة للطلب، والمرجع الخارجي لا يسوّي طلبين بالطريقة نفسها", async () => {
    const first = manual({ reference: "RCPT-9" });
    await insertAndSettle(first);
    await expect(insertManual(db, manual())).rejects.toThrow();
    const second = await insertRawOrder(db, {
      clubId,
      lines: [{ product: plan }],
      phone: "+966500000099",
    });
    const reused = manual({ orderId: second.orderId, reference: "RCPT-9" });
    await expect(insertAndSettle(reused)).rejects.toThrow();
    await insertAndSettle({ ...reused, method: "paid_at_club" });
    expect(await db.manualPayment.count()).toBe(2);
  });

  it("المسجِّل موظف موجود (مفتاح أجنبي)", async () => {
    const row = manual();
    const orphan = db.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO manual_payments (id, club_id, order_id, method, external_reference,
          received_on, amount_minor, currency, recorded_by, created_at)
        VALUES (${row.id}::uuid, ${clubId}::uuid, ${row.orderId}::uuid, 'bank_transfer', 'REF-777',
          '2026-06-15'::date, ${PLAN_PRICE}, 'SAR', ${randomUUID()}::uuid, ${TEST_NOW})`;
      await settleManually(tx, row);
    });
    await expect(orphan).rejects.toThrow();
  });
});

describe("ترحيل أساس المبيعات", () => {
  it("فهرس قائمة الطلبات موجود", async () => {
    const rows = await db.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes WHERE indexname = 'orders_club_id_created_at_idx'`;
    expect(rows[0]?.indexdef).toContain("(club_id, created_at)");
  });

  it("التدقيق يقبل كيانات المبيعات ويرفض ما عداها", async () => {
    const audit = (entityType: string) => db.$executeRaw`
      INSERT INTO audit_logs (id, club_id, entity_type, entity_id, action, actor, created_at)
      VALUES (${randomUUID()}::uuid, ${clubId}::uuid, ${entityType}, ${randomUUID()}::uuid,
        'probe', 'system', ${TEST_NOW})`;
    for (const entity of ["product", "promotion", "customer", "club", "manual_payment"]) {
      expect(await audit(entity)).toBe(1);
    }
    await expect(audit("invoice")).rejects.toThrow("audit_logs_entity_type_known");
  });
});
