import type * as MasarDb from "@masar/db";
import { TEST_ADMIN_KEY } from "@masar/db/test-support";
import { money, ok } from "@masar/domain";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StaffContext } from "../session";
import type { SettleValues } from "./form-state";

/**
 * خدمة الدفع اليدوي بقاعدة مستبدلة: ترتيب الرفض (المعاينة قبل أي قراءة)، وأن الخطوة الأولى لا تكتب،
 * وأن الثانية تنفّذ ما في الرمز وحده. السلوك الحقيقي على القاعدة في `packages/db`، وفي المتصفح.
 */
const NOW = new Date("2026-06-15T09:00:00Z");
const MINUTE_MS = 60_000;
const ORDER_ID = "018f4e2a-0000-7000-8000-000000000002";
const STAFF = { id: "018f4e2a-0000-7000-8000-000000000001", clubId: "club-1", role: "manager" };
const OTHER = { ...STAFF, id: "018f4e2a-0000-7000-8000-0000000000aa" };

function context(staff = STAFF): StaffContext {
  return { staff } as unknown as StaffContext;
}

function detail(overrides: Record<string, unknown> = {}) {
  return {
    order: {
      status: "pending_payment",
      expiresAt: new Date(NOW.getTime() + 30 * MINUTE_MS),
      createdAt: new Date("2026-06-14T10:00:00Z"),
      timeZone: "Asia/Riyadh",
      total: money(149_900),
    },
    payment: null,
    attempts: [],
    ...overrides,
  };
}

const getOrderDetail = vi.fn((): Promise<unknown> => Promise.resolve(detail()));
const recordManualPayment = vi.fn(() => Promise.resolve(ok({ orderId: ORDER_ID })));
const actual = await vi.importActual<typeof MasarDb>("@masar/db");
vi.mock("@masar/db", () => ({ ...actual, getOrderDetail, recordManualPayment }));
vi.mock("../../db", () => ({ getDb: () => ({}) }));
vi.mock("../flag", () => ({ adminSecretKey: () => TEST_ADMIN_KEY }));
const flags = { preview: false, allowed: true };
vi.mock("../../checkout/flag", () => ({ isCheckoutPreview: () => flags.preview }));
const allowManualSettle = vi.fn(() => flags.allowed);
vi.mock("../throttle", () => ({ allowManualSettle }));

const { confirmManualSettlement, prepareManualSettlement } = await import("./settle");

const VALUES: SettleValues = {
  method: "bank_transfer",
  externalReference: " TRF-88412 ",
  receivedOn: "2026-06-15",
  amount: "1,499.00",
  note: "",
};

function prepare(values: Partial<SettleValues> = {}, staff = STAFF, now = NOW) {
  return prepareManualSettlement(context(staff), ORDER_ID, { ...VALUES, ...values }, now);
}

async function tokenFor(staff = STAFF): Promise<string> {
  const prepared = await prepare({}, staff);
  if (!prepared.ok) {
    throw prepared.error;
  }
  return prepared.value.token;
}

function confirm(
  token: string,
  overrides: { confirmed?: boolean; now?: Date; staff?: typeof STAFF } = {},
) {
  return confirmManualSettlement(
    context(overrides.staff ?? STAFF),
    { orderId: ORDER_ID, token, confirmed: overrides.confirmed ?? true },
    overrides.now ?? NOW,
  );
}

function reasonOf(result: { ok: true } | { ok: false; error: { reason: string } }): string {
  return result.ok ? "ok" : result.error.reason;
}

afterEach(() => {
  vi.clearAllMocks();
  flags.preview = false;
  flags.allowed = true;
  getOrderDetail.mockImplementation(() => Promise.resolve(detail()));
});

describe("وضع المعاينة", () => {
  it("الخطوتان تُرفضان قبل أي قراءة أو كتابة أو عدّ", async () => {
    const token = await tokenFor();
    vi.clearAllMocks();
    flags.preview = true;
    expect(reasonOf(await prepare())).toBe("orders.settle_preview_refused");
    expect(reasonOf(await confirm(token))).toBe("orders.settle_preview_refused");
    expect(getOrderDetail).not.toHaveBeenCalled();
    expect(recordManualPayment).not.toHaveBeenCalled();
    expect(allowManualSettle).not.toHaveBeenCalled();
  });
});

describe("الخطوة 1: تتحقق ولا تكتب", () => {
  it("بيانات صحيحة: رمز مختوم بقيم مطبَّعة ومعرّف دفعة جديد، بلا كتابة", async () => {
    const prepared = await prepare();
    expect(prepared.ok).toBe(true);
    if (prepared.ok) {
      expect(prepared.value.payload).toMatchObject({
        amountMinor: 149_900,
        currency: "SAR",
        details: { method: "bank_transfer", externalReference: "TRF-88412", note: null },
      });
      expect(prepared.value.payload.paymentId).toMatch(/^[0-9a-f-]{36}$/);
    }
    expect(recordManualPayment).not.toHaveBeenCalled();
    expect(getOrderDetail).toHaveBeenCalledWith({}, "club-1", ORDER_ID, NOW);
  });

  it.each([
    [{ amount: "1499.001" }, "amount.too_many_decimals"],
    [{ amount: "abc" }, "amount.invalid_format"],
    [{ amount: "-1499" }, "amount.negative"],
    [{ amount: "1498.99" }, "payment.amount_mismatch"],
    [{ amount: "1500" }, "payment.amount_mismatch"],
    [{ amount: "14.99" }, "payment.amount_mismatch"],
    [{ method: "cash" }, "manual_payment.method_invalid"],
    [{ externalReference: "ab" }, "manual_payment.reference_invalid"],
    [{ receivedOn: "15/06/2026" }, "manual_payment.received_on_invalid"],
    [{ receivedOn: "2026-06-16" }, "manual_payment.received_on_invalid"],
    [{ receivedOn: "2026-06-13" }, "manual_payment.received_on_invalid"],
    [{ note: "ن".repeat(501) }, "manual_payment.note_too_long"],
  ])("%o ⇒ %s", async (values, reason) => {
    expect(reasonOf(await prepare(values))).toBe(reason);
    expect(recordManualPayment).not.toHaveBeenCalled();
  });

  it("حالة الطلب: غير موجود، بلغ مهلته، محاولة حيّة، مدفوع", async () => {
    getOrderDetail.mockResolvedValueOnce(undefined);
    expect(reasonOf(await prepare())).toBe("order.not_found");
    expect(reasonOf(await prepare({}, STAFF, new Date(NOW.getTime() + 30 * MINUTE_MS)))).toBe(
      "order.payment_window_passed",
    );
    getOrderDetail.mockResolvedValueOnce(detail({ attempts: [{ live: true }] }));
    expect(reasonOf(await prepare())).toBe("order.settle_blocked_by_live_attempt");
    const paid = { provider: "moyasar", providerPaymentId: "p-1" };
    getOrderDetail.mockResolvedValueOnce(detail({ payment: paid }));
    expect(reasonOf(await prepare())).toBe("order.already_paid");
  });
});

describe("الخطوة 2: تنفّذ ما في الرمز وحده", () => {
  it("تسجّل بقيم الرمز وباسم الموظف وناديه", async () => {
    const prepared = await prepare();
    const { token, payload } = prepared.ok ? prepared.value : { token: "", payload: null };
    expect(reasonOf(await confirm(token))).toBe("ok");
    expect(recordManualPayment).toHaveBeenCalledWith(
      {},
      {
        paymentId: payload?.paymentId,
        orderId: ORDER_ID,
        clubId: "club-1",
        details: payload?.details,
        amountMinor: 149_900,
        currency: "SAR",
        staffId: STAFF.id,
        now: NOW,
      },
    );
  });

  it("الإرسال المزدوج للرمز نفسه يصل بالمعرّف نفسه (القاعدة تعامله إعادة)", async () => {
    const token = await tokenFor();
    await confirm(token);
    await confirm(token);
    const ids = recordManualPayment.mock.calls.map(
      (call) => (call as unknown as [unknown, { paymentId: string }])[1].paymentId,
    );
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(1);
  });

  it("بلا مربع التأكيد: مرفوض بلا كتابة", async () => {
    const token = await tokenFor();
    expect(reasonOf(await confirm(token, { confirmed: false }))).toBe(
      "orders.settle_confirmation_required",
    );
    expect(recordManualPayment).not.toHaveBeenCalled();
  });

  it("رمز منتهٍ، أو لموظف آخر، أو معدَّل، أو مختلَق: مرفوض بلا كتابة", async () => {
    const token = await tokenFor();
    const late = new Date(NOW.getTime() + 10 * MINUTE_MS);
    expect(reasonOf(await confirm(token, { now: late }))).toBe("orders.settle_token_invalid");
    expect(reasonOf(await confirm(token, { staff: OTHER }))).toBe("orders.settle_token_invalid");
    expect(reasonOf(await confirm(`${token.slice(0, -2)}AA`))).toBe("orders.settle_token_invalid");
    expect(reasonOf(await confirm("not-a-token"))).toBe("orders.settle_token_invalid");
    expect(recordManualPayment).not.toHaveBeenCalled();
  });

  it("حد المحاولات لكل موظف يُفحص قبل فتح الرمز", async () => {
    const token = await tokenFor();
    flags.allowed = false;
    expect(reasonOf(await confirm(token))).toBe("orders.settle_too_many_attempts");
    expect(allowManualSettle).toHaveBeenCalledWith(STAFF.id);
    expect(recordManualPayment).not.toHaveBeenCalled();
  });
});
