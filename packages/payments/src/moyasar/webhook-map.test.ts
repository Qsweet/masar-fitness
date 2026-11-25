/**
 * إشعار Moyasar وتحويل حالاته، مقابل الأشكال الموثقة:
 * docs.moyasar.com/docs/api/other/webhooks/webhook-reference.md
 * · docs.moyasar.com/docs/api/other/webhooks/verify-webhook.md
 * · docs.moyasar.com/docs/api/other/webhooks/available-webhooks.md
 * · docs.moyasar.com/docs/api/payments/payment-status-reference.md
 */
import { describe, expect, it } from "vitest";
import {
  INVOICE_ID,
  PAYMENT_ID,
  WEBHOOK_SECRET,
  paymentEventFixture,
  paymentFixture,
  verificationEventFixture,
} from "./fixtures";
import { paymentStateOf, sessionStateOf } from "./map";
import {
  MOYASAR_INVOICE_STATUSES,
  MOYASAR_PAYMENT_STATUSES,
  parsePayment,
  type MoyasarPayment,
} from "./parse";
import { parseMoyasarNotification, type MoyasarWebhookOptions } from "./webhook";

const OPTIONS: MoyasarWebhookOptions = { webhookSecret: WEBHOOK_SECRET, mode: "test" };

function parse(body: unknown, options = OPTIONS) {
  return parseMoyasarNotification(JSON.stringify(body), options);
}

describe("parseMoyasarNotification", () => {
  it.each([
    "payment_paid",
    "payment_failed",
    "payment_refunded",
    "payment_voided",
    "payment_authorized",
    "payment_captured",
    "payment_verified",
    "payment_abandoned",
  ])("%s: منبّه بمعرّفي الدفعة والفاتورة فقط", (type) => {
    expect(parse(paymentEventFixture({ type }))).toEqual({
      ok: true,
      value: {
        kind: "payment_update",
        eventId: "8f2c1d4e-7a3b-4c9d-8e1f-2a3b4c5d6e7f",
        eventType: type,
        paymentId: PAYMENT_ID,
        sessionId: INVOICE_ID,
      },
    });
  });

  it("دفعة بلا invoice_id في الإشعار: الجلسة تُقرأ من المزوّد لاحقًا", () => {
    const data = paymentFixture({ invoice_id: null });
    expect(parse(paymentEventFixture({ data }))).toMatchObject({
      ok: true,
      value: { paymentId: PAYMENT_ID, sessionId: null },
    });
  });

  it.each([
    ["خاطئ", `${WEBHOOK_SECRET}x`],
    ["بطول مختلف", "short"],
    ["فارغ", ""],
    ["ليس نصًا", 12345],
    ["null", null],
  ])("secret_token %s ⇒ unauthenticated", (_name, token) => {
    expect(parse(paymentEventFixture({ secret_token: token }))).toEqual({
      ok: false,
      error: "unauthenticated",
    });
  });

  it("secret_token ناقص ⇒ unauthenticated، ولو كان باقي الجسم صحيحًا", () => {
    const body = paymentEventFixture();
    delete body.secret_token;
    expect(parse(body)).toEqual({ ok: false, error: "unauthenticated" });
  });

  it("السر يُفحص قبل شكل الحدث: جسم بلا نوع وبسر خاطئ unauthenticated لا malformed", () => {
    expect(parse({ secret_token: "wrong" })).toEqual({ ok: false, error: "unauthenticated" });
    expect(parse({ secret_token: WEBHOOK_SECRET })).toEqual({ ok: false, error: "malformed" });
  });

  it.each([true, undefined, "false", 0])("live=%s في وضع التجربة ⇒ mode_mismatch", (live) => {
    expect(parse(paymentEventFixture({ live }))).toEqual({ ok: false, error: "mode_mismatch" });
  });

  it("live=true مقبول في الوضع الحي فقط", () => {
    const live: MoyasarWebhookOptions = { webhookSecret: WEBHOOK_SECRET, mode: "live" };
    expect(parse(paymentEventFixture({ live: true }), live).ok).toBe(true);
    expect(parse(paymentEventFixture({ live: false }), live)).toEqual({
      ok: false,
      error: "mode_mismatch",
    });
  });

  it("webhook_verification بشكل المثال الموثق: يوثَّق مصدره ولا يُقرأ رمزه", () => {
    const result = parse(verificationEventFixture());
    expect(result).toEqual({
      ok: true,
      value: { kind: "endpoint_verification", eventId: "7a1f0e3c-5d2b-4c8e-9f61-2b8d4f0a9c13" },
    });
    expect(JSON.stringify(result)).not.toContain("482913");
    expect(parse(verificationEventFixture({ secret_token: "123" }))).toEqual({
      ok: false,
      error: "unauthenticated",
    });
  });

  it.each(["card_auth_authenticated", "card_auth_failed", "balance_transferred"])(
    "حدث لا يخص المدفوعات (%s): unrelated",
    (type) => {
      expect(parse(paymentEventFixture({ type }))).toMatchObject({
        ok: true,
        value: { kind: "unrelated", eventType: type },
      });
    },
  );

  it.each([
    ["دفعة بمعرّف ليس uuid", paymentEventFixture({ data: { id: "pay_1" } })],
    ["بلا data", paymentEventFixture({ data: null })],
    ["نوع ليس رمزًا آليًا", paymentEventFixture({ type: "Payment Paid!" })],
    ["نوع ليس نصًا", paymentEventFixture({ type: 7 })],
  ])("%s ⇒ malformed", (_name, body) => {
    expect(parse(body)).toEqual({ ok: false, error: "malformed" });
  });

  it.each(["", "{", "[]", "null", '"secret"'])("جسم ليس كائن JSON ⇒ malformed: %s", (raw) => {
    expect(parseMoyasarNotification(raw, OPTIONS)).toEqual({ ok: false, error: "malformed" });
  });
});

describe("تحويل الحالات: جدول شامل لكل حالة موثقة", () => {
  it("حالات الفاتورة", () => {
    const mapped = Object.fromEntries(
      MOYASAR_INVOICE_STATUSES.map((status) => [status, sessionStateOf(status)]),
    );
    expect(mapped).toEqual({
      initiated: "open",
      expired: "closed",
      canceled: "closed",
      paid: "indeterminate",
      failed: "indeterminate",
      refunded: "indeterminate",
      on_hold: "indeterminate",
      voided: "indeterminate",
    });
  });

  function payment(overrides: Record<string, unknown>): MoyasarPayment {
    const parsed = parsePayment(paymentFixture(overrides));
    if (!parsed.ok) {
      throw parsed.error;
    }
    return parsed.value;
  }

  it("حالات الدفعة", () => {
    const mapped = Object.fromEntries(
      MOYASAR_PAYMENT_STATUSES.map((status) => [status, paymentStateOf(payment({ status }))]),
    );
    expect(mapped).toEqual({
      initiated: "in_progress",
      paid: "paid",
      authorized: "authorized",
      failed: "failed",
      refunded: "refunded",
      voided: "voided",
      captured: "indeterminate",
      verified: "indeterminate",
      expired: "indeterminate",
    });
  });

  it("دفعة paid استُرد منها شيء ليست مدفوعة كاملة", () => {
    expect(paymentStateOf(payment({ refunded: 1 }))).toBe("refunded");
  });

  it.each([
    ["حالة غير موثقة", { status: "settled" }, "payment_status_unknown"],
    ["مبلغ كسري", { amount: 10.5 }, "payment_amount"],
    ["مبلغ سالب", { amount: -1 }, "payment_amount"],
    ["عملة بأحرف صغيرة", { currency: "sar" }, "payment_amount"],
    ["refunded ناقص", { refunded: undefined }, "payment_amount"],
    ["invoice_id ليس uuid", { invoice_id: "inv_1" }, "payment_invoice_id"],
    ["معرّف ليس uuid", { id: "pay_1" }, "payment_id"],
  ])("دفعة بغير الشكل الموثق (%s) ⇒ malformed_response", (_name, overrides, code) => {
    const parsed = parsePayment(paymentFixture(overrides));
    expect(parsed.ok ? null : [parsed.error.kind, parsed.error.code]).toEqual([
      "malformed_response",
      code,
    ]);
  });

  it("نوع مصدر بشكل غريب لا يُحفظ", () => {
    expect(payment({ source: { type: "Credit Card 4111" } }).method).toBeNull();
    expect(payment({ source: null }).method).toBeNull();
    expect(payment({ source: { type: "applepay" } }).method).toBe("applepay");
  });
});
