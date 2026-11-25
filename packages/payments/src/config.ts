/**
 * إعداد الدفع من متغيرات البيئة. كلها اختيارية: بلا `PAYMENTS_MODE` (أو `off`) لا مزوّد ولا زر دفع
 * والسلوك كما كان. الأخطاء تذكر اسم المتغير وسبب الرفض فقط، لا قيمته.
 * الأسماء في PHASE4_PAYMENTS_DESIGN §5.12، ومعها `PAYMENTS_PROVIDER` لاختيار المحوّل (القرار 50).
 */
import { err, ok, type Result } from "@masar/domain";

export const PAYMENT_ENV_VARIABLES = [
  "PAYMENTS_MODE",
  "PAYMENTS_PROVIDER",
  "PAYMENTS_MIN_PAYMENT_MINUTES",
  "MOYASAR_SECRET_KEY",
  "MOYASAR_WEBHOOK_SECRET",
  "PAYMENTS_FAKE_WEBHOOK_SECRET",
] as const;

export type PaymentEnvVariable = (typeof PAYMENT_ENV_VARIABLES)[number];
export type PaymentEnv = Readonly<Partial<Record<PaymentEnvVariable, string | undefined>>>;

export interface ConfigProblem {
  readonly variable: PaymentEnvVariable;
  readonly message: string;
}

interface ActiveBase {
  readonly mode: "test";
  /** أقل وقت معقول لإكمال الدفع بالدقائق. بلا قيمة افتراضية: يُقاس في التجربة (WP0). */
  readonly minPaymentMinutes: number;
}

export type PaymentsConfig =
  | { readonly mode: "off" }
  | (ActiveBase & {
      readonly provider: "moyasar";
      readonly moyasarSecretKey: string;
      readonly moyasarWebhookSecret: string;
    })
  /** مزوّد اختبار في الذاكرة: للاختبارات والعرض التجريبي المحلي فقط، لا مال حقيقي. */
  | (ActiveBase & { readonly provider: "fake"; readonly fakeWebhookSecret: string });

export type ActivePaymentsConfig = Exclude<PaymentsConfig, { mode: "off" }>;

/** بادئة المفتاح السري التجريبي في Moyasar: docs.moyasar.com/docs/getting-started/authentication.md */
const MOYASAR_TEST_SECRET_PREFIX = "sk_test_";
/** أقل طول لسر الإشعار. `openssl rand -hex 32` يعطي 64 محرفًا. */
const MIN_WEBHOOK_SECRET_LENGTH = 32;
const MAX_MIN_PAYMENT_MINUTES = 120;
const POSITIVE_INTEGER = /^[1-9][0-9]*$/;

function present(value: string | undefined): value is string {
  return value !== undefined && value !== "";
}

function webhookSecretProblem(variable: PaymentEnvVariable, value: string | undefined) {
  if (!present(value)) {
    return { variable, message: "is required for the selected payment provider" };
  }
  if (value.length < MIN_WEBHOOK_SECRET_LENGTH) {
    const length = String(MIN_WEBHOOK_SECRET_LENGTH);
    return { variable, message: `must be at least ${length} characters` };
  }
  return undefined;
}

function minPaymentMinutes(env: PaymentEnv, problems: ConfigProblem[]): number {
  const variable = "PAYMENTS_MIN_PAYMENT_MINUTES";
  const raw = env[variable];
  if (!present(raw)) {
    problems.push({ variable, message: "is required when payments are on (no default)" });
    return 0;
  }
  const minutes = POSITIVE_INTEGER.test(raw) ? Number(raw) : Number.NaN;
  if (!Number.isSafeInteger(minutes) || minutes > MAX_MIN_PAYMENT_MINUTES) {
    const max = String(MAX_MIN_PAYMENT_MINUTES);
    problems.push({ variable, message: `must be a whole number of minutes from 1 to ${max}` });
    return 0;
  }
  return minutes;
}

function moyasarConfig(env: PaymentEnv, base: ActiveBase, problems: ConfigProblem[]) {
  const secretKey = env.MOYASAR_SECRET_KEY;
  const webhookSecret = env.MOYASAR_WEBHOOK_SECRET;
  if (!present(secretKey)) {
    problems.push({ variable: "MOYASAR_SECRET_KEY", message: "is required for moyasar" });
  } else if (!secretKey.startsWith(MOYASAR_TEST_SECRET_PREFIX)) {
    const message = `must be a test secret key (${MOYASAR_TEST_SECRET_PREFIX}…) in test mode`;
    problems.push({ variable: "MOYASAR_SECRET_KEY", message });
  }
  const secretProblem = webhookSecretProblem("MOYASAR_WEBHOOK_SECRET", webhookSecret);
  if (secretProblem !== undefined) {
    problems.push(secretProblem);
  } else if (webhookSecret === secretKey) {
    const message = "must not equal the API secret key";
    problems.push({ variable: "MOYASAR_WEBHOOK_SECRET", message });
  }
  return {
    ...base,
    provider: "moyasar" as const,
    moyasarSecretKey: secretKey ?? "",
    moyasarWebhookSecret: webhookSecret ?? "",
  };
}

function fakeConfig(env: PaymentEnv, base: ActiveBase, problems: ConfigProblem[]) {
  const secret = env.PAYMENTS_FAKE_WEBHOOK_SECRET;
  const problem = webhookSecretProblem("PAYMENTS_FAKE_WEBHOOK_SECRET", secret);
  if (problem !== undefined) {
    problems.push(problem);
  }
  return { ...base, provider: "fake" as const, fakeWebhookSecret: secret ?? "" };
}

function activeConfig(env: PaymentEnv, problems: ConfigProblem[]): PaymentsConfig {
  const base: ActiveBase = { mode: "test", minPaymentMinutes: minPaymentMinutes(env, problems) };
  if (env.PAYMENTS_PROVIDER === "moyasar") {
    return moyasarConfig(env, base, problems);
  }
  if (env.PAYMENTS_PROVIDER === "fake") {
    return fakeConfig(env, base, problems);
  }
  const message = "must be moyasar or fake when payments are on";
  problems.push({ variable: "PAYMENTS_PROVIDER", message });
  return { mode: "off" };
}

/**
 * يتحقق من إعداد الدفع. `live` مرفوض في الكود حتى يأذن المالك إذنًا مستقلًا، فيُرفع الرفض حينها
 * بإيداع مراجَع. مفتاح حي في وضع التجربة مرفوض: الوضع يُفحص بالبادئة.
 */
export function parsePaymentsConfig(env: PaymentEnv): Result<PaymentsConfig, ConfigProblem[]> {
  const mode = env.PAYMENTS_MODE;
  if (!present(mode) || mode === "off") {
    return ok({ mode: "off" });
  }
  if (mode === "live") {
    const message = "live payments are not enabled: they need the owner's separate approval";
    return err([{ variable: "PAYMENTS_MODE", message }]);
  }
  if (mode !== "test") {
    return err([{ variable: "PAYMENTS_MODE", message: "must be off or test" }]);
  }
  const problems: ConfigProblem[] = [];
  const config = activeConfig(env, problems);
  return problems.length === 0 ? ok(config) : err(problems);
}
