import { describe, expect, it } from "vitest";
import { money } from "../../money";
import {
  MANUAL_PAYMENT_METHODS,
  MANUAL_PAYMENT_PROVIDER,
  decideManualSettlement,
  isManualPaymentMethod,
  validateManualPayment,
  type ManualPaymentDraft,
  type ManualSettlementRequest,
  type ManuallySettleableOrder,
} from "./manual-settlement";
import { ORDER_STATUSES } from "./order-state";
import { plainDate } from "./plain-date";
import { decideSettlement } from "./settlement";

const NOW = new Date("2026-06-15T09:00:00Z");
const TOTAL = 149_900;
const PAYMENT_ID = "018f4e2a-7b1c-7d3e-9f4a-5b6c7d8e9f01";

function order(overrides: Partial<ManuallySettleableOrder> = {}): ManuallySettleableOrder {
  return {
    status: "pending_payment",
    expiresAt: new Date(NOW.getTime() + 60_000),
    total: money(TOTAL),
    hasLiveAttempt: false,
    existing: null,
    ...overrides,
  };
}

function request(overrides: Partial<ManualSettlementRequest> = {}): ManualSettlementRequest {
  return { paymentId: PAYMENT_ID, amountMinor: TOTAL, currency: "SAR", ...overrides };
}

function decide(
  orderOverrides: Partial<ManuallySettleableOrder> = {},
  requestOverrides: Partial<ManualSettlementRequest> = {},
  now = NOW,
): string {
  const decision = decideManualSettlement(order(orderOverrides), request(requestOverrides), now);
  return decision.ok ? decision.value : decision.error.reason;
}

describe("decideManualSettlement", () => {
  it("معلّق في مهلته، بلا محاولة حيّة، والمبلغ يساوي الإجمالي: يُسجَّل", () => {
    expect(decide()).toBe("apply");
  });

  it("الدفعة اليدوية نفسها مسجّلة: إعادة بلا كتابة، أيًّا كانت حالة الطلب اليوم", () => {
    const existing = { provider: MANUAL_PAYMENT_PROVIDER, providerPaymentId: PAYMENT_ID };
    expect(decide({ status: "fulfilled", existing })).toBe("replay");
    expect(decide({ status: "refunded", existing, expiresAt: NOW })).toBe("replay");
  });

  it("مدفوع بدفعة أخرى (يدوية بمعرّف آخر أو من مزوّد): order.already_paid", () => {
    const other = { provider: MANUAL_PAYMENT_PROVIDER, providerPaymentId: "another-id" };
    expect(decide({ status: "fulfilled", existing: other })).toBe("order.already_paid");
    const provider = { provider: "moyasar", providerPaymentId: PAYMENT_ID };
    expect(decide({ status: "paid", existing: provider })).toBe("order.already_paid");
  });

  it.each(ORDER_STATUSES.filter((status) => status !== "pending_payment"))(
    "الحالة %s بلا دفعة مسجّلة لا تُدفع",
    (status) => {
      expect(decide({ status })).toBe("order.not_payable");
    },
  );

  it("بلغ مهلته ولو لم يُكتب منتهيًا: مرفوض (decideSettlement لا تفحص هذا)", () => {
    expect(decide({ expiresAt: NOW })).toBe("order.payment_window_passed");
    expect(decide({ expiresAt: new Date(NOW.getTime() - 1) })).toBe("order.payment_window_passed");
    expect(decide({ expiresAt: new Date(NOW.getTime() + 1) })).toBe("apply");
    const provider = { provider: "manual", providerPaymentId: PAYMENT_ID, amountMinor: TOTAL };
    const settle = decideSettlement(
      { status: "pending_payment", total: money(TOTAL), paid: null },
      { ...provider, currency: "SAR" },
    );
    expect(settle).toEqual({ ok: true, value: "apply" });
  });

  it("محاولة دفع حيّة تمنع التسجيل", () => {
    expect(decide({ hasLiveAttempt: true })).toBe("order.settle_blocked_by_live_attempt");
  });

  it("المبلغ يساوي الإجمالي بالهللة تمامًا: لا دفع جزئي ولا زائد", () => {
    expect(decide({}, { amountMinor: TOTAL - 1 })).toBe("payment.amount_mismatch");
    expect(decide({}, { amountMinor: TOTAL + 1 })).toBe("payment.amount_mismatch");
    expect(decide({}, { amountMinor: 0 })).toBe("payment.amount_mismatch");
    expect(decide({}, { currency: "USD" })).toBe("payment.currency_mismatch");
  });

  it("ترتيب الرفض: الحالة ثم المهلة ثم المحاولة الحيّة ثم المبلغ", () => {
    const everything = { expiresAt: NOW, hasLiveAttempt: true };
    expect(decide({ ...everything, status: "expired" }, { amountMinor: 1 })).toBe(
      "order.not_payable",
    );
    expect(decide(everything, { amountMinor: 1 })).toBe("order.payment_window_passed");
    expect(decide({ hasLiveAttempt: true }, { amountMinor: 1 })).toBe(
      "order.settle_blocked_by_live_attempt",
    );
  });

  it("خطأ المبلغ يحمل اسم الحقل", () => {
    const decision = decideManualSettlement(order(), request({ amountMinor: 1 }), NOW);
    expect(decision.ok ? null : decision.error.field).toBe("amount");
  });
});

const CALENDAR = { orderCreatedOn: plainDate(2026, 6, 14), today: plainDate(2026, 6, 15) };

function draft(overrides: Partial<ManualPaymentDraft> = {}): ManualPaymentDraft {
  return {
    method: "bank_transfer",
    externalReference: "TRF-88412",
    receivedOn: plainDate(2026, 6, 15),
    note: "",
    ...overrides,
  };
}

function validate(overrides: Partial<ManualPaymentDraft> = {}): string {
  const result = validateManualPayment(draft(overrides), CALENDAR);
  return result.ok ? "ok" : result.error.reason;
}

describe("validateManualPayment", () => {
  it("الطريقتان المقبولتان وحدهما", () => {
    expect(MANUAL_PAYMENT_METHODS).toEqual(["bank_transfer", "paid_at_club"]);
    expect(validate({ method: "paid_at_club" })).toBe("ok");
    expect(validate({ method: "cash" })).toBe("manual_payment.method_invalid");
    expect(validate({ method: "" })).toBe("manual_payment.method_invalid");
    expect(isManualPaymentMethod("manual")).toBe(false);
  });

  it("المرجع إلزامي لكل طريقة: 3 إلى 64 محرفًا بعد التشذيب", () => {
    for (const method of MANUAL_PAYMENT_METHODS) {
      expect(validate({ method, externalReference: "" })).toBe("manual_payment.reference_invalid");
    }
    expect(validate({ externalReference: "  ab  " })).toBe("manual_payment.reference_invalid");
    expect(validate({ externalReference: "abc" })).toBe("ok");
    expect(validate({ externalReference: "س".repeat(64) })).toBe("ok");
    expect(validate({ externalReference: "س".repeat(65) })).toBe(
      "manual_payment.reference_invalid",
    );
  });

  it("المرجع يُحفظ مشذَّبًا وبلا محارف غير مرئية", () => {
    const result = validateManualPayment(draft({ externalReference: " ‏TRF-88412‎\t" }), CALENDAR);
    expect(result.ok ? result.value.externalReference : null).toBe("TRF-88412");
    expect(validate({ externalReference: "‏‎ a \u0000" })).toBe("manual_payment.reference_invalid");
  });

  it("تاريخ الاستلام بين يوم إنشاء الطلب واليوم", () => {
    expect(validate({ receivedOn: plainDate(2026, 6, 14) })).toBe("ok");
    expect(validate({ receivedOn: plainDate(2026, 6, 15) })).toBe("ok");
    expect(validate({ receivedOn: plainDate(2026, 6, 16) })).toBe(
      "manual_payment.received_on_invalid",
    );
    expect(validate({ receivedOn: plainDate(2026, 6, 13) })).toBe(
      "manual_payment.received_on_invalid",
    );
  });

  it("الملاحظة اختيارية حتى 500 محرف، والفارغة null", () => {
    const empty = validateManualPayment(draft({ note: "   " }), CALENDAR);
    expect(empty.ok ? empty.value.note : "?").toBeNull();
    const kept = validateManualPayment(draft({ note: " وصل عبر الراجحي " }), CALENDAR);
    expect(kept.ok ? kept.value.note : null).toBe("وصل عبر الراجحي");
    expect(validate({ note: "ن".repeat(500) })).toBe("ok");
    expect(validate({ note: "ن".repeat(501) })).toBe("manual_payment.note_too_long");
  });
});
