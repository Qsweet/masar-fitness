import { describe, expect, it } from "vitest";
import { parsePaymentsConfig, type PaymentEnv } from "./config";

const WEBHOOK_SECRET = "w".repeat(32);
const MOYASAR: PaymentEnv = {
  PAYMENTS_MODE: "test",
  PAYMENTS_PROVIDER: "moyasar",
  PAYMENTS_MIN_PAYMENT_MINUTES: "10",
  MOYASAR_SECRET_KEY: "sk_test_fixture-not-a-real-key",
  MOYASAR_WEBHOOK_SECRET: WEBHOOK_SECRET,
};
const FAKE: PaymentEnv = {
  PAYMENTS_MODE: "test",
  PAYMENTS_PROVIDER: "fake",
  PAYMENTS_MIN_PAYMENT_MINUTES: "10",
  PAYMENTS_FAKE_WEBHOOK_SECRET: WEBHOOK_SECRET,
};

function problems(env: PaymentEnv): string[] {
  const result = parsePaymentsConfig(env);
  return result.ok ? [] : result.error.map((problem) => `${problem.variable}: ${problem.message}`);
}

describe("parsePaymentsConfig", () => {
  it.each([{}, { PAYMENTS_MODE: "" }, { PAYMENTS_MODE: "off" }])(
    "بلا وضع أو off ⇒ الدفع مغلق: %j",
    (env) => {
      expect(parsePaymentsConfig(env)).toEqual({ ok: true, value: { mode: "off" } });
    },
  );

  it("الدفع المغلق يتجاهل أسرارًا مضبوطة بلا وضع", () => {
    const env = { ...MOYASAR, PAYMENTS_MODE: undefined };
    expect(parsePaymentsConfig(env)).toEqual({ ok: true, value: { mode: "off" } });
  });

  it("Moyasar التجريبي بإعداد كامل", () => {
    expect(parsePaymentsConfig(MOYASAR)).toEqual({
      ok: true,
      value: {
        mode: "test",
        provider: "moyasar",
        minPaymentMinutes: 10,
        moyasarSecretKey: MOYASAR.MOYASAR_SECRET_KEY,
        moyasarWebhookSecret: WEBHOOK_SECRET,
        moyasarHostedPageOrigin: null,
      },
    });
  });

  it("أصل صفحة الدفع المستضافة اختياري وبلا افتراضي، ويُقبل أصل https فقط", () => {
    const origin = "https://pay.example";
    const parsed = parsePaymentsConfig({ ...MOYASAR, MOYASAR_HOSTED_PAGE_ORIGIN: origin });
    expect(parsed).toMatchObject({ ok: true, value: { moyasarHostedPageOrigin: origin } });
    for (const bad of [
      "http://pay.example",
      "https://pay.example/",
      "https://pay.example/x",
      "pay.example",
      "*",
    ]) {
      expect(problems({ ...MOYASAR, MOYASAR_HOSTED_PAGE_ORIGIN: bad })).toEqual([
        "MOYASAR_HOSTED_PAGE_ORIGIN: must be an https origin without a path, like https://host.example",
      ]);
    }
  });

  it("مزوّد الاختبار بإعداد كامل", () => {
    expect(parsePaymentsConfig(FAKE)).toEqual({
      ok: true,
      value: {
        mode: "test",
        provider: "fake",
        minPaymentMinutes: 10,
        fakeWebhookSecret: WEBHOOK_SECRET,
      },
    });
  });

  it("live مرفوض حتى إذن المالك، ولو كان الإعداد كاملًا", () => {
    const env = { ...MOYASAR, PAYMENTS_MODE: "live", MOYASAR_SECRET_KEY: "sk_live_fixture" };
    expect(problems(env)).toEqual([
      "PAYMENTS_MODE: live payments are not enabled: they need the owner's separate approval",
    ]);
  });

  it("وضع غير معروف مرفوض", () => {
    expect(problems({ ...MOYASAR, PAYMENTS_MODE: "sandbox" })).toEqual([
      "PAYMENTS_MODE: must be off or test",
    ]);
  });

  it.each([undefined, "", "tabby", "Moyasar"])("مزوّد ناقص أو غير معروف مرفوض: %s", (provider) => {
    expect(problems({ ...MOYASAR, PAYMENTS_PROVIDER: provider })).toContain(
      "PAYMENTS_PROVIDER: must be moyasar or fake when payments are on",
    );
  });

  it("مفتاح حي في وضع التجربة مرفوض، والرسالة بلا قيمته", () => {
    const secret = "sk_live_should-never-appear-in-errors";
    const found = problems({ ...MOYASAR, MOYASAR_SECRET_KEY: secret });
    expect(found).toEqual([
      "MOYASAR_SECRET_KEY: must be a test secret key (sk_test_…) in test mode",
    ]);
    expect(found.join(" ")).not.toContain(secret);
  });

  it("مفتاح أو سر إشعار ناقص مرفوضان معًا", () => {
    const env = { ...MOYASAR, MOYASAR_SECRET_KEY: undefined, MOYASAR_WEBHOOK_SECRET: "" };
    expect(problems(env)).toEqual([
      "MOYASAR_SECRET_KEY: is required for moyasar",
      "MOYASAR_WEBHOOK_SECRET: is required for the selected payment provider",
    ]);
  });

  it("سر إشعار قصير، أو يساوي المفتاح السري، مرفوض", () => {
    expect(problems({ ...MOYASAR, MOYASAR_WEBHOOK_SECRET: "short" })).toEqual([
      "MOYASAR_WEBHOOK_SECRET: must be at least 32 characters",
    ]);
    const key = `sk_test_${"k".repeat(40)}`;
    const same = { ...MOYASAR, MOYASAR_SECRET_KEY: key, MOYASAR_WEBHOOK_SECRET: key };
    expect(problems(same)).toEqual(["MOYASAR_WEBHOOK_SECRET: must not equal the API secret key"]);
  });

  it("سر إشعار مزوّد الاختبار إلزامي معه", () => {
    expect(problems({ ...FAKE, PAYMENTS_FAKE_WEBHOOK_SECRET: undefined })).toEqual([
      "PAYMENTS_FAKE_WEBHOOK_SECRET: is required for the selected payment provider",
    ]);
  });

  it("أقل وقت للدفع بلا قيمة افتراضية", () => {
    expect(problems({ ...FAKE, PAYMENTS_MIN_PAYMENT_MINUTES: undefined })).toEqual([
      "PAYMENTS_MIN_PAYMENT_MINUTES: is required when payments are on (no default)",
    ]);
  });

  it.each(["0", "-5", "1.5", "1e2", "ten", "121", " 10"])(
    "أقل وقت للدفع غير صالح: «%s»",
    (minutes) => {
      expect(problems({ ...FAKE, PAYMENTS_MIN_PAYMENT_MINUTES: minutes })).toEqual([
        "PAYMENTS_MIN_PAYMENT_MINUTES: must be a whole number of minutes from 1 to 120",
      ]);
    },
  );
});
