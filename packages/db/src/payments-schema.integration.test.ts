import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDb, type Db } from "./index";
import {
  createPlan,
  createTestClub,
  expireRawOrder,
  insertRawOrder,
  markRawPaid,
  TEST_NOW,
  type TestProduct,
} from "./test-support/commerce-fixtures";
import { createDbClients, disconnectAll, testDatabaseUrl } from "./test-support/commerce-orders";
import {
  insertRawAttempt,
  setRawAttempt,
  type RawAttemptInput,
} from "./test-support/payments-fixtures";
import { resetCommerceTables } from "./test-support/reset-database";

const PLAN_PRICE = 90_000;

let db: Db;
let clubId: string;
let plan: TestProduct;
let orderId: string;

beforeAll(async () => {
  db = createDb(testDatabaseUrl());
  await resetCommerceTables(db);
  clubId = await createTestClub(db);
  plan = await createPlan(db, clubId, { priceMinor: PLAN_PRICE, durationMonths: 1 });
});

beforeEach(async () => {
  await db.$executeRaw`
    TRUNCATE audit_logs, memberships, order_discounts, order_items, orders, customers CASCADE`;
  orderId = await newOrder();
});

afterAll(async () => {
  await resetCommerceTables(db);
  await db.$disconnect();
});

async function newOrder(): Promise<string> {
  const order = await insertRawOrder(db, {
    clubId,
    lines: [{ product: plan }],
    createdAt: TEST_NOW,
  });
  return order.orderId;
}

function insertAttempt(client: Db, target: string, overrides: Partial<RawAttemptInput> = {}) {
  return insertRawAttempt(client, {
    clubId,
    orderId: target,
    amountMinor: PLAN_PRICE,
    ...overrides,
  });
}

function setAttempt(id: string, assignment: string) {
  return setRawAttempt(db, id, assignment);
}

const TO_PENDING = "status = 'pending', provider_session_id = 's-1'";
const TO_CAPTURED = "status = 'captured', provider_payment_id = 'p-1'";
const TO_FAILED = `status = 'failed', failure_reason = 'payment_failed', ended_at = now()`;
const TO_EXPIRED = "status = 'expired', ended_at = now()";

describe("T8: إدراج محاولة يطابق طلبها", () => {
  it("محاولة صحيحة لطلب معلّق تُقبل بحالة created", async () => {
    const attempt = await insertAttempt(db, orderId);
    expect(attempt).toMatchObject({ status: "created", checkCount: 0, settledAt: null });
  });

  it("طلب مدفوع أو منتهٍ لا تُدرج له محاولة", async () => {
    await markRawPaid(db, orderId, { paidAt: TEST_NOW });
    await expect(insertAttempt(db, orderId)).rejects.toThrow("payment_attempt_order_not_pending");
    const expired = await newOrder();
    await expireRawOrder(db, expired);
    await expect(insertAttempt(db, expired)).rejects.toThrow("payment_attempt_order_not_pending");
  });

  it.each([
    ["مبلغ يخالف الطلب بهللة", { amountMinor: PLAN_PRICE - 1 }],
    ["عملة تخالف الطلب", { currency: "USD" }],
  ])("%s مرفوض", async (_name, overrides) => {
    await expect(insertAttempt(db, orderId, overrides)).rejects.toThrow(
      "payment_attempt_snapshot_mismatch",
    );
  });

  it("نادٍ يخالف نادي الطلب مرفوض", async () => {
    const other = await createTestClub(db);
    await expect(insertAttempt(db, orderId, { clubId: other })).rejects.toThrow(
      "payment_attempt_snapshot_mismatch",
    );
  });

  it("موعد عند مهلة الطلب أو بعدها مرفوض", async () => {
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    await expect(insertAttempt(db, orderId, { deadlineAt: order.expiresAt })).rejects.toThrow(
      "payment_attempt_deadline_after_expiry",
    );
  });

  it.each([
    ["حالة غير created", { status: "pending" as const, providerSessionId: "s-1" }],
    ["معرّف جلسة عند الإدراج", { providerSessionId: "s-1" }],
    ["تسوية عند الإدراج", { settledAt: TEST_NOW, settlementResult: "paid" }],
  ])("%s مرفوض", async (_name, overrides) => {
    await expect(insertAttempt(db, orderId, overrides)).rejects.toThrow(
      "payment_attempt_initial_state",
    );
  });

  it("محاولة حيّة ثانية مرفوضة، وبعد فشل الأولى تُقبل", async () => {
    const first = await insertAttempt(db, orderId);
    await expect(insertAttempt(db, orderId)).rejects.toThrow("payment_attempt_live_exists");
    await setAttempt(first.id, TO_FAILED);
    await expect(insertAttempt(db, orderId)).resolves.toMatchObject({ status: "created" });
  });

  it("محاولة محصَّلة سُجّل رفض تسويتها ليست حيّة: تُقبل محاولة جديدة", async () => {
    const first = await insertAttempt(db, orderId);
    await setAttempt(first.id, TO_PENDING);
    await setAttempt(first.id, TO_CAPTURED);
    await expect(insertAttempt(db, orderId)).rejects.toThrow("payment_attempt_live_exists");
    await setAttempt(first.id, "settled_at = now(), settlement_result = 'payment.amount_mismatch'");
    await expect(insertAttempt(db, orderId)).resolves.toMatchObject({ status: "created" });
  });

  it("عشرون إدراجًا متزامنًا للطلب نفسه: محاولة واحدة", async () => {
    const clients = createDbClients(20);
    try {
      const results = await Promise.allSettled(
        clients.map((client) => insertAttempt(client, orderId)),
      );
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(await db.paymentAttempt.count({ where: { orderId } })).toBe(1);
    } finally {
      await disconnectAll(clients);
    }
  });
});

describe("T8: الحالة تتقدم فقط والمراجع ثابتة", () => {
  let attemptId: string;

  beforeEach(async () => {
    attemptId = (await insertAttempt(db, orderId)).id;
  });

  it("المسار created ← pending ← captured يُقبل", async () => {
    await setAttempt(attemptId, TO_PENDING);
    await setAttempt(attemptId, TO_CAPTURED);
    const row = await db.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    expect(row).toMatchObject({ status: "captured", providerPaymentId: "p-1" });
  });

  it("لا جلسة بلا معرّفها، ولا تحصيل بلا معرّف دفعته", async () => {
    await expect(setAttempt(attemptId, "status = 'pending'")).rejects.toThrow(
      "payment_attempts_session_required",
    );
    await setAttempt(attemptId, TO_PENDING);
    await expect(setAttempt(attemptId, "status = 'captured'")).rejects.toThrow(
      "payment_attempts_payment_required",
    );
  });

  it("لا رجوع إلى حالة سابقة", async () => {
    await setAttempt(attemptId, TO_PENDING);
    await expect(setAttempt(attemptId, "status = 'created'")).rejects.toThrow(
      "payment_attempt_status_backward",
    );
    await setAttempt(attemptId, TO_CAPTURED);
    await expect(setAttempt(attemptId, "status = 'pending'")).rejects.toThrow(
      "payment_attempt_status_backward",
    );
  });

  it("المال المحصَّل لا يصير failed ولا expired", async () => {
    await setAttempt(attemptId, TO_PENDING);
    await setAttempt(attemptId, TO_CAPTURED);
    await expect(setAttempt(attemptId, TO_FAILED)).rejects.toThrow(
      "payment_attempt_status_backward",
    );
    await expect(setAttempt(attemptId, TO_EXPIRED)).rejects.toThrow(
      "payment_attempt_status_backward",
    );
    await expect(setAttempt(attemptId, "status = 'voided', ended_at = now()")).resolves.toBe(1);
  });

  it("created لا تصير expired ولا voided ولا refunded", async () => {
    for (const status of ["expired", "voided", "refunded"]) {
      const update = setAttempt(
        attemptId,
        `status = '${status}', ended_at = now(), provider_session_id = 's-1', provider_payment_id = 'p-1'`,
      );
      await expect(update).rejects.toThrow("payment_attempt_status_backward");
    }
  });

  it.each([TO_FAILED, `${TO_PENDING}; ${TO_EXPIRED}`])("النهائي نهائي: %s", async (path) => {
    for (const step of path.split("; ")) {
      await setAttempt(attemptId, step);
    }
    await expect(
      setAttempt(attemptId, "status = 'pending', provider_session_id = 's-1'"),
    ).rejects.toThrow("payment_attempt_status_final");
  });

  it("الفشل بلا سبب، والنهائي بلا وقت نهايته، مرفوضان", async () => {
    await expect(setAttempt(attemptId, "status = 'failed', ended_at = now()")).rejects.toThrow(
      "payment_attempts_failure_reason_state",
    );
    await expect(
      setAttempt(attemptId, "status = 'failed', failure_reason = 'payment_failed'"),
    ).rejects.toThrow("payment_attempts_ended_state");
  });

  it.each([
    "amount_minor = amount_minor + 1",
    "currency = 'USD'",
    "provider = 'other_pay'",
    "provider_mode = 'live'",
    "deadline_at = deadline_at + interval '1 minute'",
    "created_at = created_at - interval '1 minute'",
  ])("شرط ثابت لا يُعدَّل: %s", async (assignment) => {
    await expect(setAttempt(attemptId, assignment)).rejects.toThrow(
      "payment_attempt_terms_immutable",
    );
  });

  it("الطلب لا يُستبدل، ومعرّفا المزوّد يُكتبان مرة", async () => {
    const other = await newOrder();
    await expect(setAttempt(attemptId, `order_id = '${other}'`)).rejects.toThrow(
      "payment_attempt_terms_immutable",
    );
    await setAttempt(attemptId, TO_PENDING);
    await expect(setAttempt(attemptId, "provider_session_id = 's-2'")).rejects.toThrow(
      "payment_attempt_reference_immutable",
    );
    await setAttempt(attemptId, TO_CAPTURED);
    await expect(setAttempt(attemptId, "provider_payment_id = 'p-2'")).rejects.toThrow(
      "payment_attempt_reference_immutable",
    );
  });

  it("التسوية تُكتب كاملة ومرة واحدة، ولا تسوية بلا دفعة", async () => {
    await expect(setAttempt(attemptId, "settled_at = now()")).rejects.toThrow(
      "payment_attempts_settlement_complete",
    );
    await expect(
      setAttempt(attemptId, "settled_at = now(), settlement_result = 'paid'"),
    ).rejects.toThrow("payment_attempts_settlement_has_payment");
    await setAttempt(attemptId, TO_PENDING);
    await setAttempt(attemptId, `${TO_CAPTURED}, settled_at = now(), settlement_result = 'paid'`);
    await expect(setAttempt(attemptId, "settlement_result = 'replayed'")).rejects.toThrow(
      "payment_attempt_settlement_immutable",
    );
  });

  it("معرّف الجلسة والدفعة فريدان لكل مزوّد", async () => {
    await setAttempt(attemptId, TO_PENDING);
    await setAttempt(attemptId, TO_CAPTURED);
    const second = await insertAttempt(db, await newOrder());
    await expect(setAttempt(second.id, TO_PENDING)).rejects.toThrow(
      "payment_attempts_provider_provider_session_id_key",
    );
    await setAttempt(second.id, "status = 'pending', provider_session_id = 's-2'");
    await expect(setAttempt(second.id, TO_CAPTURED)).rejects.toThrow(
      "payment_attempts_provider_provider_payment_id_key",
    );
  });

  it("قيود القيم: المزوّد والبيئة والعدّاد", async () => {
    const order = await newOrder();
    await expect(insertAttempt(db, order, { provider: "Bad-Name" })).rejects.toThrow(
      "payment_attempts_provider_shape",
    );
    await expect(insertAttempt(db, order, { providerMode: "sandbox" })).rejects.toThrow(
      "payment_attempts_provider_mode_known",
    );
    await expect(setAttempt(attemptId, "check_count = -1")).rejects.toThrow(
      "payment_attempts_check_count_non_negative",
    );
  });

  it("المحاولة لا تُحذف", async () => {
    await expect(db.paymentAttempt.delete({ where: { id: attemptId } })).rejects.toThrow(
      "payment_attempt_delete_forbidden",
    );
  });
});
