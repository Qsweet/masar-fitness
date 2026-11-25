import { describe, expect, it } from "vitest";
import { money } from "../../money";
import type { OrderStatus } from "./order-state";
import { decideSettlement, type SettleableOrder, type VerifiedPayment } from "./settlement";

const PAYMENT: VerifiedPayment = {
  provider: "moyasar",
  providerPaymentId: "pay_123",
  amountMinor: 99_900,
  currency: "SAR",
};

function order(status: OrderStatus, paid: SettleableOrder["paid"] = null): SettleableOrder {
  return { status, total: money(99_900), paid };
}

function reasonOf(target: SettleableOrder, payment: VerifiedPayment = PAYMENT): string | null {
  const result = decideSettlement(target, payment);
  return result.ok ? null : result.error.reason;
}

describe("decideSettlement", () => {
  it("طلب معلّق بالمبلغ والعملة نفسيهما ⇒ apply", () => {
    expect(decideSettlement(order("pending_payment"), PAYMENT)).toEqual({
      ok: true,
      value: "apply",
    });
  });

  it("الدفعة نفسها مسجّلة ⇒ replay بلا كتابة", () => {
    const paid = { provider: "moyasar", providerPaymentId: "pay_123" };
    expect(decideSettlement(order("fulfilled", paid), PAYMENT)).toEqual({
      ok: true,
      value: "replay",
    });
  });

  it("دفعة أخرى على طلب مدفوع ⇒ order.already_paid", () => {
    const paid = { provider: "moyasar", providerPaymentId: "pay_other" };
    expect(reasonOf(order("paid", paid))).toBe("order.already_paid");
  });

  it("المزوّد مختلف والمعرّف نفسه ليس إعادة", () => {
    const paid = { provider: "tap", providerPaymentId: "pay_123" };
    expect(reasonOf(order("paid", paid))).toBe("order.already_paid");
  });

  it.each(["expired", "cancelled"] as const)("طلب %s لا يُدفع ⇒ order.not_payable", (status) => {
    expect(reasonOf(order(status))).toBe("order.not_payable");
  });

  it("نقص هللة واحدة ⇒ payment.amount_mismatch", () => {
    expect(reasonOf(order("pending_payment"), { ...PAYMENT, amountMinor: 99_899 })).toBe(
      "payment.amount_mismatch",
    );
  });

  it("زيادة أو مبلغ غير صحيح ⇒ payment.amount_mismatch", () => {
    for (const amountMinor of [99_901, 999.0001, Number.NaN]) {
      expect(reasonOf(order("pending_payment"), { ...PAYMENT, amountMinor })).toBe(
        "payment.amount_mismatch",
      );
    }
  });

  it("عملة أخرى ⇒ payment.currency_mismatch ولو تطابق المبلغ", () => {
    expect(reasonOf(order("pending_payment"), { ...PAYMENT, currency: "USD" })).toBe(
      "payment.currency_mismatch",
    );
    expect(reasonOf(order("pending_payment"), { ...PAYMENT, currency: "sar" })).toBe(
      "payment.currency_mismatch",
    );
  });

  it("فحص الحالة يسبق المبلغ: طلب منتهٍ بمبلغ خاطئ ⇒ not_payable", () => {
    expect(reasonOf(order("expired"), { ...PAYMENT, amountMinor: 1 })).toBe("order.not_payable");
  });

  it.each([
    ["", "pay_1"],
    ["M", "pay_1"],
    ["Moyasar", "pay_1"],
    ["1pay", "pay_1"],
    ["moyasar-x", "pay_1"],
    ["a".repeat(33), "pay_1"],
    ["moyasar", ""],
    ["moyasar", "x".repeat(201)],
  ])("مرجع غير صالح (%s، %s) ⇒ validation payment.invalid_reference", (provider, id) => {
    const result = decideSettlement(order("pending_payment"), {
      ...PAYMENT,
      provider,
      providerPaymentId: id,
    });
    expect(result.ok ? null : [result.error.code, result.error.reason]).toEqual([
      "validation",
      "payment.invalid_reference",
    ]);
  });

  it("حدود المرجع المقبولة: مزوّد بحرفين و32 حرفًا، ومعرّف بمحرف و200 محرف", () => {
    for (const [provider, id] of [
      ["ab", "x"],
      ["a".repeat(32), "x".repeat(200)],
    ] as const) {
      const payment = { ...PAYMENT, provider, providerPaymentId: id };
      expect(decideSettlement(order("pending_payment"), payment).ok).toBe(true);
    }
  });
});
