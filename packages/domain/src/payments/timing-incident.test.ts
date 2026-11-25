import { describe, expect, it } from "vitest";
import { INCIDENT_KINDS, incidentKindForRejection } from "./incident";
import { PROVIDER_SESSION_MARGIN_MINUTES, paymentDeadline } from "./timing";

const MINUTE_MS = 60_000;
const NOW = new Date("2026-06-15T09:00:00Z");
const MIN_PAYMENT = 10;

function expiresIn(minutes: number, extraMs = 0): Date {
  return new Date(NOW.getTime() + minutes * MINUTE_MS + extraMs);
}

describe("paymentDeadline", () => {
  it("الموعد = مهلة الطلب ناقص الهامش", () => {
    const result = paymentDeadline({
      now: NOW,
      orderExpiresAt: expiresIn(30),
      minPaymentMinutes: MIN_PAYMENT,
    });
    expect(result).toEqual({
      ok: true,
      value: expiresIn(30 - PROVIDER_SESSION_MARGIN_MINUTES),
    });
  });

  it("الحد عند الملّي ثانية: يكفي تمامًا يُقبل، وأقل بملّي ثانية يُرفض", () => {
    const exact = MIN_PAYMENT + PROVIDER_SESSION_MARGIN_MINUTES;
    const enough = paymentDeadline({
      now: NOW,
      orderExpiresAt: expiresIn(exact),
      minPaymentMinutes: MIN_PAYMENT,
    });
    expect(enough.ok).toBe(true);
    const short = paymentDeadline({
      now: NOW,
      orderExpiresAt: expiresIn(exact, -1),
      minPaymentMinutes: MIN_PAYMENT,
    });
    expect(short.ok ? null : [short.error.code, short.error.reason]).toEqual([
      "conflict",
      "payment.window_too_short",
    ]);
  });

  it("طلب فاتت مهلته لا تبدأ له محاولة", () => {
    const result = paymentDeadline({
      now: NOW,
      orderExpiresAt: expiresIn(-1),
      minPaymentMinutes: MIN_PAYMENT,
    });
    expect(result.ok).toBe(false);
  });

  it.each([0, -5, 1.5, Number.NaN])("أقل وقت للدفع غير صالح يُرمى: %s", (minutes) => {
    expect(() =>
      paymentDeadline({ now: NOW, orderExpiresAt: expiresIn(60), minPaymentMinutes: minutes }),
    ).toThrow("payment.invalid_min_payment_time");
  });
});

describe("incidentKindForRejection", () => {
  it.each([
    ["order.not_payable", "late_payment_not_payable"],
    ["payment.amount_mismatch", "amount_mismatch"],
    ["payment.currency_mismatch", "currency_mismatch"],
    ["order.already_paid", "order_already_paid"],
    ["payment.already_used", "payment_already_used"],
    ["payment.invalid_reference", "unknown_reference"],
    ["order.not_found", "unknown_reference"],
  ])("%s ⇒ %s", (reason, kind) => {
    expect(incidentKindForRejection(reason)).toBe(kind);
    expect(INCIDENT_KINDS).toContain(kind);
  });

  it.each(["order.payment_not_recorded", "toString", "constructor", ""])(
    "سبب غير معروف لا يُخمَّن: «%s»",
    (reason) => {
      expect(incidentKindForRejection(reason)).toBeUndefined();
    },
  );
});
