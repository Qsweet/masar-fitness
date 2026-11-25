/**
 * حمولات اختبار بشكل الأمثلة الموثقة حرفيًا (كل الحقول المذكورة في المثال، بقيم اختبار):
 * - الفاتورة: docs.moyasar.com/api/invoices/01-create-invoice («Example (from schema)»)
 * - الدفعة: docs.moyasar.com/api/payments/02-fetch-payment و docs.moyasar.com/docs/api/metadata.md
 * - أخطاء 400/401/403/404: docs.moyasar.com/api/invoices/01-create-invoice و …/payments/02-fetch-payment
 * - كائن الإشعار: docs.moyasar.com/docs/api/other/webhooks/webhook-reference.md
 * - حدث التحقق: docs.moyasar.com/docs/api/other/webhooks/verify-webhook.md
 * - مفاتيح الكوبون: docs.moyasar.com/docs/guides/coupons/index.md
 * ليست تسجيلات من البيئة التجريبية: تُستبدل بحمولات WP0 المنقّحة حين تُجرى.
 */
export const INVOICE_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
export const PAYMENT_ID = "760878ec-d1d3-5f72-9056-191683f55872";
export const ATTEMPT_ID = "0193a000-0000-7000-8000-000000000001";
export const ORDER_REFERENCE = "MSR-0001000";
export const AMOUNT_MINOR = 90_000;
export const HOSTED_URL = `https://checkout.moyasar.com/invoices/${INVOICE_ID}?lang=ar`;
export const RETURN_URL = "https://shop.example/checkout/orders/token/return";

type Json = Record<string, unknown>;

/** بشكل مثال الدفعة: فيها اسم حامل البطاقة ورقمها المقنَّع وIP، ليثبت الاختبار أنها لا تخرج. */
export function paymentFixture(overrides: Json = {}): Json {
  return {
    id: PAYMENT_ID,
    status: "paid",
    amount: AMOUNT_MINOR,
    fee: 1580,
    currency: "SAR",
    refunded: 0,
    refunded_at: null,
    captured: 0,
    captured_at: null,
    voided_at: null,
    description: `طلب ${ORDER_REFERENCE}`,
    amount_format: "900.00 SAR",
    fee_format: "15.80 SAR",
    refunded_format: "0.00 SAR",
    captured_format: "0.00 SAR",
    invoice_id: INVOICE_ID,
    ip: "203.0.113.7",
    callback_url: null,
    created_at: "2026-06-15T09:03:17.000Z",
    updated_at: "2026-06-15T09:03:19.633Z",
    metadata: { attempt_id: ATTEMPT_ID, order_ref: ORDER_REFERENCE },
    source: {
      type: "creditcard",
      company: "mada",
      name: "Saleh Ali",
      number: "4201-32XX-XXXX-1010",
      message: "APPROVED",
      transaction_url: null,
      gateway_id: "moyasar_cc_ce1iUidxhxhdbz74257S891wvW",
      reference_number: "125478454231",
    },
    ...overrides,
  };
}

export function invoiceFixture(overrides: Json = {}): Json {
  return {
    id: INVOICE_ID,
    status: "initiated",
    amount: AMOUNT_MINOR,
    currency: "SAR",
    description: `طلب ${ORDER_REFERENCE}`,
    logo_url: "https://example.com/default.png",
    amount_format: "900.00 SAR",
    url: HOSTED_URL,
    callback_url: null,
    expired_at: "2026-06-15T09:25:00.000Z",
    created_at: "2026-06-15T09:00:00.000Z",
    updated_at: "2026-06-15T09:00:00.000Z",
    back_url: RETURN_URL,
    success_url: RETURN_URL,
    payments: [],
    metadata: { attempt_id: ATTEMPT_ID, order_ref: ORDER_REFERENCE },
    ...overrides,
  };
}

export const ERROR_BODIES = {
  validation: {
    type: "invalid_request",
    message: null,
    errors: { amount: ["must be greater than or equal to 100"] },
  },
  authentication: {
    type: "authentication_error",
    message: "Invalid authorization credentials",
    errors: null,
  },
  forbidden: { type: "api_error", message: "User not authorized", errors: null },
  notFound: {
    type: "record_not_found",
    message: "The <object type> record you were looking for was not found.",
    errors: null,
  },
} as const;

export const WEBHOOK_SECRET = "moyasar-webhook-secret-for-unit-tests-only";

/** إشعار دفعة بشكل كائن الإشعار الموثق، و`data` دفعة. */
export function paymentEventFixture(overrides: Json = {}): Json {
  return {
    id: "8f2c1d4e-7a3b-4c9d-8e1f-2a3b4c5d6e7f",
    type: "payment_paid",
    created_at: "2026-06-15T09:03:20Z",
    secret_token: WEBHOOK_SECRET,
    account_name: "Test Club",
    live: false,
    data: paymentFixture(),
    ...overrides,
  };
}

/** بشكل مثال «Verification event» حرفيًا (بلا `live`). */
export function verificationEventFixture(overrides: Json = {}): Json {
  return {
    id: "7a1f0e3c-5d2b-4c8e-9f61-2b8d4f0a9c13",
    type: "webhook_verification",
    created_at: "2024-01-15T10:05:12Z",
    secret_token: WEBHOOK_SECRET,
    account_name: "My Store",
    data: { webhook_id: "c4bc247d-5288-4673-9b40-39c082ac7fbb", verification_code: "482913" },
    ...overrides,
  };
}
