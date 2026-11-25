/**
 * محوّل Moyasar مقابل حمولات بشكل الأمثلة الموثقة (fixtures.ts)، بـfetch محقون: لا شبكة.
 * الوثائق: docs.moyasar.com/api/invoices/01-create-invoice · docs.moyasar.com/api/invoices/04-show-invoice
 * · docs.moyasar.com/api/invoices/06-cancel-invoice · docs.moyasar.com/api/payments/02-fetch-payment
 * · docs.moyasar.com/docs/getting-started/authentication.md
 */
import { describe, expect, it } from "vitest";
import type { HostedPaymentRequest } from "../port";
import {
  AMOUNT_MINOR,
  ATTEMPT_ID,
  ERROR_BODIES,
  HOSTED_URL,
  INVOICE_ID,
  ORDER_REFERENCE,
  RETURN_URL,
  invoiceFixture,
} from "./fixtures";
import { BASE, SECRET_KEY, errorOf, setup } from "./stub-fetch";

const REQUEST: HostedPaymentRequest = {
  attemptId: ATTEMPT_ID,
  orderReference: ORDER_REFERENCE,
  amountMinor: AMOUNT_MINOR,
  currency: "SAR",
  description: `طلب ${ORDER_REFERENCE}`,
  expiresAt: new Date("2026-06-15T09:25:00Z"),
  successUrl: RETURN_URL,
  backUrl: RETURN_URL,
};

describe("createHostedPayment: POST /invoices", () => {
  it("يرسل المبلغ بالهللة والموعد ISO والمرجعين في metadata، بمصادقة Basic والمفتاح اسم مستخدم", async () => {
    const { provider, calls } = setup({
      "POST /invoices": { status: 201, body: invoiceFixture() },
    });
    const hosted = await provider.createHostedPayment(REQUEST);
    expect(hosted).toEqual({
      ok: true,
      value: { sessionId: INVOICE_ID, redirectUrl: HOSTED_URL, rawStatus: "initiated" },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ method: "POST", url: `${BASE}/invoices` });
    expect(calls[0]?.body).toEqual({
      amount: 90_000,
      currency: "SAR",
      description: `طلب ${ORDER_REFERENCE}`,
      expired_at: "2026-06-15T09:25:00.000Z",
      success_url: RETURN_URL,
      back_url: RETURN_URL,
      metadata: { attempt_id: ATTEMPT_ID, order_ref: ORDER_REFERENCE },
    });
    const basic = Buffer.from(`${SECRET_KEY}:`).toString("base64");
    expect(calls[0]?.headers).toMatchObject({
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
    });
  });

  it("لا يرسل callback_url ولا apply_coupon ولا phone ولا أي بيانات شخصية", async () => {
    const { provider, calls } = setup({
      "POST /invoices": { status: 201, body: invoiceFixture() },
    });
    await provider.createHostedPayment(REQUEST);
    const sent = Object.keys(calls[0]?.body as object).sort();
    expect(sent).toEqual([
      "amount",
      "back_url",
      "currency",
      "description",
      "expired_at",
      "metadata",
      "success_url",
    ]);
  });

  it("مبلغ دون الحد الأدنى للفاتورة يُرفض قبل أي استدعاء", async () => {
    const { provider, calls } = setup({});
    const result = await provider.createHostedPayment({ ...REQUEST, amountMinor: 99 });
    expect(errorOf(result)).toEqual(["rejected", "amount_below_invoice_minimum"]);
    expect(calls).toHaveLength(0);
  });

  it("انقطاع الشبكة: unreachable بلا إعادة للإنشاء", async () => {
    const { provider, calls } = setup({ "POST /invoices": "network_error" });
    const result = await provider.createHostedPayment(REQUEST);
    expect(errorOf(result)).toEqual(["unreachable", "network_or_timeout"]);
    expect(calls).toHaveLength(1);
  });

  it.each([
    [400, ERROR_BODIES.validation, "rejected", "invalid_request"],
    [401, ERROR_BODIES.authentication, "unauthorized", "authentication_error"],
    [403, ERROR_BODIES.forbidden, "unauthorized", "api_error"],
    [500, { type: "api_error", message: "boom", errors: null }, "unreachable", "api_error"],
    [502, "<html>bad gateway</html>", "unreachable", null],
  ])("رد %i ⇒ %s بنوع الخطأ فقط، بلا نص الرسالة", async (status, body, kind, code) => {
    const { provider, calls } = setup({ "POST /invoices": { status, body } });
    const result = await provider.createHostedPayment(REQUEST);
    expect(errorOf(result)).toEqual([kind, code]);
    expect(result.ok ? "" : result.error.message).not.toMatch(
      /Invalid authorization|User not|boom/,
    );
    expect(calls).toHaveLength(1);
  });

  it.each([
    ["مبلغ مختلف", { amount: AMOUNT_MINOR - 1 }, "invoice_amount_echo"],
    ["عملة مختلفة", { currency: "USD" }, "invoice_amount_echo"],
    ["metadata بلا معرّف المحاولة", { metadata: {} }, "invoice_metadata_echo"],
    ["حالة غير initiated", { status: "paid" }, "invoice_not_initiated"],
    ["رابط دفع http", { url: HOSTED_URL.replace("https:", "http:") }, "hosted_url_not_https"],
    ["بلا رابط دفع", { url: null }, "hosted_url_not_https"],
  ])("فاتورة لا تعيد ما أرسلناه (%s): تُلغى ولا تُعرض", async (_name, overrides, code) => {
    const { provider, calls } = setup({
      "POST /invoices": { status: 201, body: invoiceFixture(overrides) },
      [`PUT /invoices/${INVOICE_ID}/cancel`]: {
        status: 200,
        body: invoiceFixture({ status: "canceled" }),
      },
    });
    const result = await provider.createHostedPayment(REQUEST);
    expect(errorOf(result)).toEqual(["malformed_response", code]);
    expect(calls.map((call) => call.method)).toEqual(["POST", "PUT"]);
  });

  it.each([
    ["معرّف ليس uuid", { id: "inv_1" }, "invoice_id"],
    ["حالة غير موثقة", { status: "settled" }, "invoice_status_unknown"],
    ["مبلغ كسري", { amount: 900.5 }, "invoice_amount"],
    ["مبلغ نصي", { amount: "90000" }, "invoice_amount"],
  ])("رد بغير الشكل الموثق (%s) لا يُخمَّن", async (_name, overrides, code) => {
    const { provider } = setup({
      "POST /invoices": { status: 201, body: invoiceFixture(overrides) },
    });
    expect(errorOf(await provider.createHostedPayment(REQUEST))).toEqual([
      "malformed_response",
      code,
    ]);
  });
});
