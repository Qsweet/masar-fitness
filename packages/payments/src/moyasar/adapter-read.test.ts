/**
 * محوّل Moyasar مقابل حمولات بشكل الأمثلة الموثقة (fixtures.ts)، بـfetch محقون: لا شبكة.
 * الوثائق: docs.moyasar.com/api/invoices/01-create-invoice · docs.moyasar.com/api/invoices/04-show-invoice
 * · docs.moyasar.com/api/invoices/06-cancel-invoice · docs.moyasar.com/api/payments/02-fetch-payment
 * · docs.moyasar.com/docs/getting-started/authentication.md
 */
import { describe, expect, it } from "vitest";
import {
  AMOUNT_MINOR,
  ATTEMPT_ID,
  ERROR_BODIES,
  HOSTED_URL,
  INVOICE_ID,
  PAYMENT_ID,
  invoiceFixture,
  paymentFixture,
} from "./fixtures";
import { BASE, SECOND_PAYMENT_ID, errorOf, setup } from "./stub-fetch";

describe("fetchSession: GET /invoices/:id ثم GET /payments/:id لكل دفعة", () => {
  it("فاتورة مفتوحة بلا دفعات", async () => {
    const { provider } = setup({
      [`GET /invoices/${INVOICE_ID}`]: { status: 200, body: invoiceFixture() },
    });
    expect(await provider.fetchSession(INVOICE_ID)).toEqual({
      ok: true,
      value: {
        redirectUrl: HOSTED_URL,
        snapshot: {
          provider: "moyasar",
          sessionId: INVOICE_ID,
          mode: "test",
          state: "open",
          rawStatus: "initiated",
          attemptId: ATTEMPT_ID,
          payments: [],
        },
      },
    });
  });

  it("الدفعة تُقرأ قراءة مستقلة، ولا يخرج منها إلا القائمة البيضاء", async () => {
    const listed = paymentFixture({ status: "initiated", amount: 1 });
    const { provider, calls } = setup({
      [`GET /invoices/${INVOICE_ID}`]: {
        status: 200,
        body: invoiceFixture({ status: "paid", payments: [listed] }),
      },
      [`GET /payments/${PAYMENT_ID}`]: { status: 200, body: paymentFixture() },
    });
    const view = await provider.fetchSession(INVOICE_ID);
    expect(view).toEqual({
      ok: true,
      value: {
        redirectUrl: null,
        snapshot: {
          provider: "moyasar",
          sessionId: INVOICE_ID,
          mode: "test",
          state: "indeterminate",
          rawStatus: "paid",
          attemptId: ATTEMPT_ID,
          payments: [
            {
              paymentId: PAYMENT_ID,
              state: "paid",
              rawStatus: "paid",
              amountMinor: AMOUNT_MINOR,
              currency: "SAR",
              sessionId: INVOICE_ID,
              method: "creditcard",
              couponApplied: false,
            },
          ],
        },
      },
    });
    expect(JSON.stringify(view)).not.toMatch(/Saleh|4201|203\.0\.113|APPROVED|gateway/);
    expect(calls.map((call) => `${call.method} ${call.url.replace(BASE, "")}`)).toEqual([
      `GET /invoices/${INVOICE_ID}`,
      `GET /payments/${PAYMENT_ID}`,
    ]);
    expect(calls.every((call) => call.body === undefined)).toBe(true);
  });

  it("دفعتان: فاشلة ثم مدفوعة بكوبون طبّقه المزوّد", async () => {
    const coupon = {
      attempt_id: ATTEMPT_ID,
      "#coupon_id": "7848a897-10e7-4977-b719-81884d4cc999",
      "#coupon_code": "RAJHI15",
      "#coupon_discount": 15,
      "#coupon_original_amount": AMOUNT_MINOR,
      "#coupon_max_discount_amount": 15_000,
    };
    const failed = paymentFixture({ id: SECOND_PAYMENT_ID, status: "failed" });
    const discounted = paymentFixture({ amount: AMOUNT_MINOR - 13_500, metadata: coupon });
    const { provider } = setup({
      [`GET /invoices/${INVOICE_ID}`]: {
        status: 200,
        body: invoiceFixture({ payments: [failed, discounted] }),
      },
      [`GET /payments/${SECOND_PAYMENT_ID}`]: { status: 200, body: failed },
      [`GET /payments/${PAYMENT_ID}`]: { status: 200, body: discounted },
    });
    const view = await provider.fetchSession(INVOICE_ID);
    const payments = view.ok ? view.value.snapshot.payments : [];
    expect(
      payments.map((payment) => [payment.state, payment.amountMinor, payment.couponApplied]),
    ).toEqual([
      ["failed", AMOUNT_MINOR, false],
      ["paid", AMOUNT_MINOR - 13_500, true],
    ]);
  });

  it("فشل قراءة دفعة يُفشل القراءة كلها: لا لقطة ناقصة", async () => {
    const { provider } = setup({
      [`GET /invoices/${INVOICE_ID}`]: {
        status: 200,
        body: invoiceFixture({ payments: [paymentFixture()] }),
      },
      [`GET /payments/${PAYMENT_ID}`]: { status: 404, body: ERROR_BODIES.notFound },
    });
    expect(errorOf(await provider.fetchSession(INVOICE_ID))).toEqual([
      "not_found",
      "record_not_found",
    ]);
  });

  it("فاتورة بمعرّف آخر في الرد، أو معرّف ليس uuid، لا تُقبل", async () => {
    const other = "99999999-8888-4777-8666-555555555555";
    const { provider, calls } = setup({
      [`GET /invoices/${INVOICE_ID}`]: { status: 200, body: invoiceFixture({ id: other }) },
    });
    expect(errorOf(await provider.fetchSession(INVOICE_ID))).toEqual([
      "malformed_response",
      "invoice_id_echo",
    ]);
    expect(errorOf(await provider.fetchSession("../payments"))).toEqual([
      "malformed_response",
      "id_not_uuid",
    ]);
    expect(calls).toHaveLength(1);
  });
});

describe("بقية العمليات", () => {
  it("fetchPaymentSession: فاتورة الدفعة من قراءة خادمية", async () => {
    const { provider } = setup({
      [`GET /payments/${PAYMENT_ID}`]: { status: 200, body: paymentFixture() },
      [`GET /payments/${SECOND_PAYMENT_ID}`]: {
        status: 200,
        body: paymentFixture({ id: SECOND_PAYMENT_ID, invoice_id: null }),
      },
    });
    expect(await provider.fetchPaymentSession(PAYMENT_ID)).toEqual({ ok: true, value: INVOICE_ID });
    expect(await provider.fetchPaymentSession(SECOND_PAYMENT_ID)).toEqual({
      ok: true,
      value: null,
    });
  });

  it("cancelSession: PUT /invoices/:id/cancel", async () => {
    const { provider, calls } = setup({
      [`PUT /invoices/${INVOICE_ID}/cancel`]: {
        status: 200,
        body: invoiceFixture({ status: "canceled" }),
      },
    });
    expect(await provider.cancelSession(INVOICE_ID)).toEqual({ ok: true, value: undefined });
    expect(calls[0]).toMatchObject({ method: "PUT", body: undefined });
  });

  it("البحث عن الفاتورة اليتيمة ينتظر التجربة (WP0): خطأ صريح بلا استدعاء", async () => {
    const { provider, calls } = setup({});
    expect(errorOf(await provider.findSessionsForAttempt(ATTEMPT_ID))).toEqual([
      "needs_sandbox_verification",
      "moyasar.list_invoices_by_metadata",
    ]);
    expect(calls).toHaveLength(0);
  });
});
