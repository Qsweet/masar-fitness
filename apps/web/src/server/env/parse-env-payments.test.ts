import { describe, expect, it } from "vitest";
import { InvalidEnvError, parseEnv } from "./parse-env";

const SECRET_KEY = "sk_test_fixture-not-a-real-key";
const WEBHOOK_SECRET = "w".repeat(40);
const base = {
  DATABASE_URL: "postgresql://user:pass@db.internal:5432/masar",
  SITE_URL: "https://preview.example.com",
};
const moyasar = {
  ...base,
  PAYMENTS_MODE: "test",
  PAYMENTS_PROVIDER: "moyasar",
  PAYMENTS_MIN_PAYMENT_MINUTES: "10",
  MOYASAR_SECRET_KEY: SECRET_KEY,
  MOYASAR_WEBHOOK_SECRET: WEBHOOK_SECRET,
};
const fake = {
  ...base,
  SITE_URL: "http://127.0.0.1:3102",
  PAYMENTS_MODE: "test",
  PAYMENTS_PROVIDER: "fake",
  PAYMENTS_MIN_PAYMENT_MINUTES: "10",
  PAYMENTS_FAKE_WEBHOOK_SECRET: WEBHOOK_SECRET,
};
const CHECKOUT_OFF =
  "CHECKOUT_ENABLED: must stay off in production unless payments run in test mode on a non-indexable site";

function failureOf(raw: Record<string, string | undefined>): InvalidEnvError {
  try {
    parseEnv(raw);
  } catch (error) {
    if (error instanceof InvalidEnvError) {
      return error;
    }
    throw error;
  }
  throw new Error("expected parseEnv to throw");
}

function problemsOf(raw: Record<string, string | undefined>): readonly string[] {
  return failureOf(raw).problems;
}

describe("parseEnv: الدفع اختياري ومغلق افتراضيًا", () => {
  it.each([{}, { PAYMENTS_MODE: "" }, { PAYMENTS_MODE: "off" }])(
    "بلا وضع دفع الإعداد كما كان: %j",
    (extra) => {
      expect(parseEnv({ ...base, ...extra }).PAYMENTS).toEqual({ mode: "off" });
    },
  );

  it("Moyasar التجريبي: المفاتيح داخل PAYMENTS وحده، لا حقولًا خامًا في الإعداد", () => {
    const env = parseEnv(moyasar);
    expect(env.PAYMENTS).toEqual({
      mode: "test",
      provider: "moyasar",
      minPaymentMinutes: 10,
      moyasarSecretKey: SECRET_KEY,
      moyasarWebhookSecret: WEBHOOK_SECRET,
    });
    expect(Object.keys(env).sort()).toEqual([
      "APP_VERSION",
      "CHECKOUT_ENABLED",
      "DATABASE_URL",
      "NODE_ENV",
      "PAYMENTS",
      "SITE_INDEXABLE",
      "SITE_URL",
    ]);
  });

  it("الإقلاع يفشل مع live، ومع مفتاح حي في وضع التجربة، ومع سر إشعار ناقص", () => {
    expect(problemsOf({ ...moyasar, PAYMENTS_MODE: "live" })).toEqual([
      "PAYMENTS_MODE: live payments are not enabled: they need the owner's separate approval",
    ]);
    expect(problemsOf({ ...moyasar, MOYASAR_SECRET_KEY: "sk_live_fixture" })).toEqual([
      "MOYASAR_SECRET_KEY: must be a test secret key (sk_test_…) in test mode",
    ]);
    expect(problemsOf({ ...moyasar, MOYASAR_WEBHOOK_SECRET: undefined })).toEqual([
      "MOYASAR_WEBHOOK_SECRET: is required for the selected payment provider",
    ]);
  });

  it("رسالة الخطأ تذكر اسم المتغير لا قيمته", () => {
    const secret = "sk_live_must-never-be-printed-anywhere";
    const failure = failureOf({
      ...moyasar,
      MOYASAR_SECRET_KEY: secret,
      MOYASAR_WEBHOOK_SECRET: "tiny",
    });
    expect(failure.message).toContain("MOYASAR_SECRET_KEY");
    expect(failure.message).toContain("MOYASAR_WEBHOOK_SECRET");
    expect(failure.message).not.toContain(secret);
    expect(failure.message).not.toContain("tiny");
  });

  it("مزوّد الاختبار يعمل على عنوان الجهاز نفسه فقط", () => {
    expect(parseEnv(fake).PAYMENTS).toMatchObject({ provider: "fake" });
    expect(
      parseEnv({ ...fake, NODE_ENV: "production", CHECKOUT_ENABLED: "true" }).PAYMENTS,
    ).toMatchObject({
      provider: "fake",
    });
    expect(problemsOf({ ...fake, SITE_URL: "https://preview.example.com" })).toEqual([
      "PAYMENTS_PROVIDER: fake is a local simulation: SITE_URL must be a loopback address",
    ]);
  });
});

describe("parseEnv: فتح الشراء في الإنتاج (القرار 51)", () => {
  const production = { ...moyasar, NODE_ENV: "production", CHECKOUT_ENABLED: "true" };

  it("معاينة عامة غير مفهرسة مع Moyasar التجريبي: مقبول", () => {
    expect(parseEnv(production)).toMatchObject({ CHECKOUT_ENABLED: true, SITE_INDEXABLE: false });
  });

  it("الموقع المفهرس لا يفتح الشراء ولو مع Moyasar التجريبي", () => {
    expect(problemsOf({ ...production, SITE_INDEXABLE: "true" })).toEqual([CHECKOUT_OFF]);
  });

  it("بلا مزوّد دفع يبقى الشراء مغلقًا على الرابط العام كما كان", () => {
    expect(problemsOf({ ...base, NODE_ENV: "production", CHECKOUT_ENABLED: "true" })).toEqual([
      CHECKOUT_OFF,
    ]);
  });

  it("الدفع المضبوط لا يفتح الشراء وحده: العلم يبقى مغلقًا افتراضيًا", () => {
    expect(parseEnv({ ...moyasar, NODE_ENV: "production" }).CHECKOUT_ENABLED).toBe(false);
  });
});
