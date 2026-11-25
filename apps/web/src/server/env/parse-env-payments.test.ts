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
  "CHECKOUT_ENABLED: must stay off in production: a public sandbox preview needs PAYMENTS_PUBLIC_SANDBOX=yes, Moyasar test mode and SITE_INDEXABLE off";

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
      moyasarHostedPageOrigin: null,
    });
    expect(Object.keys(env).sort()).toEqual([
      "APP_VERSION",
      "CHECKOUT_ENABLED",
      "DATABASE_URL",
      "NODE_ENV",
      "PAYMENTS",
      "PAYMENTS_ALLOW_FAKE",
      "PAYMENTS_PUBLIC_SANDBOX",
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

  const FAKE_REJECTED =
    "PAYMENTS_PROVIDER: fake is a local simulation: SITE_URL must be a loopback address, and production builds also need PAYMENTS_ALLOW_FAKE=yes";

  it("مزوّد الاختبار: عنوان الجهاز نفسه دائمًا، وعلى بناء إنتاجي بإذن صريح أيضًا", () => {
    expect(parseEnv(fake).PAYMENTS).toMatchObject({ provider: "fake" });
    expect(problemsOf({ ...fake, SITE_URL: "https://preview.example.com" })).toEqual([
      FAKE_REJECTED,
    ]);
    const production = { ...fake, NODE_ENV: "production", CHECKOUT_ENABLED: "true" };
    expect(problemsOf(production)).toEqual([FAKE_REJECTED]);
    for (const value of ["true", "1", "YES", ""]) {
      expect(problemsOf({ ...production, PAYMENTS_ALLOW_FAKE: value })).toEqual([FAKE_REJECTED]);
    }
    const allowed = parseEnv({ ...production, PAYMENTS_ALLOW_FAKE: "yes" });
    expect(allowed).toMatchObject({ PAYMENTS_ALLOW_FAKE: true, PAYMENTS: { provider: "fake" } });
    // الإذن لا يغني عن عنوان الجهاز
    const publicUrl = {
      ...production,
      PAYMENTS_ALLOW_FAKE: "yes",
      SITE_URL: "https://preview.example.com",
    };
    expect(problemsOf(publicUrl)).toContain(FAKE_REJECTED);
  });
});

describe("parseEnv: فتح الشراء في الإنتاج (القرار 54)", () => {
  const production = { ...moyasar, NODE_ENV: "production", CHECKOUT_ENABLED: "true" };

  const sandbox = { ...production, PAYMENTS_PUBLIC_SANDBOX: "yes" };

  it("الافتراضي آمن: Moyasar التجريبي وحده لا يفتح الشراء على رابط عام", () => {
    expect(problemsOf(production)).toEqual([CHECKOUT_OFF]);
    for (const value of ["true", "1", "YES"]) {
      expect(problemsOf({ ...production, PAYMENTS_PUBLIC_SANDBOX: value })).toEqual([CHECKOUT_OFF]);
    }
  });

  it("بالإذن الصريح مع Moyasar التجريبي وفهرسة مغلقة: مقبول", () => {
    expect(parseEnv(sandbox)).toMatchObject({
      CHECKOUT_ENABLED: true,
      SITE_INDEXABLE: false,
      PAYMENTS_PUBLIC_SANDBOX: true,
    });
  });

  it("الإذن الصريح بلا Moyasar التجريبي لا يكفي", () => {
    const noProvider = { ...base, NODE_ENV: "production", CHECKOUT_ENABLED: "true" };
    expect(problemsOf({ ...noProvider, PAYMENTS_PUBLIC_SANDBOX: "yes" })).toEqual([CHECKOUT_OFF]);
  });

  it("الموقع المفهرس لا يفتح الشراء ولو مع Moyasar التجريبي", () => {
    expect(problemsOf({ ...sandbox, SITE_INDEXABLE: "true" })).toEqual([CHECKOUT_OFF]);
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
