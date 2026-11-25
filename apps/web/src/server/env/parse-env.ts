import { PAYMENT_ENV_VARIABLES, parsePaymentsConfig, type PaymentsConfig } from "@masar/payments";
import { z } from "zod";
import { isSiteIndexable } from "../../config/indexability";

const postgresUrl = z
  .url()
  .refine((value) => /^postgres(ql)?:\/\//.test(value), "must be a postgres:// URL");

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** https إلزامي لأي رابط عام. الاستثناء الوحيد عنوان الجهاز نفسه (اختبار البناء الإنتاجي محليًا وفي CI). */
function isSecureOrLoopback(siteUrl: string): boolean {
  const url = new URL(siteUrl);
  return url.protocol === "https:" || LOOPBACK_HOSTS.has(url.hostname);
}

function isLoopback(siteUrl: string): boolean {
  return LOOPBACK_HOSTS.has(new URL(siteUrl).hostname);
}

const webUrl = z.url().refine((value) => /^https?:\/\//.test(value), "must be an http(s) URL");

/** متغير اختياري: الفارغ كالغائب. */
const optionalText = z
  .string()
  .optional()
  .transform((value) => (value === "" ? undefined : value));

const rawSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: postgresUrl,
  /** الرابط العام للموقع بلا شرطة أخيرة، مثل https://example.com */
  SITE_URL: webUrl.transform((value) => value.replace(/\/+$/, "")),
  SITE_INDEXABLE: z.string().optional().transform(isSiteIndexable),
  /** الشراء الإلكتروني: مغلق إلا بالقيمة "true" حرفيًا. */
  CHECKOUT_ENABLED: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  /** يضبطه النشر (رقم الإصدار أو معرّف الإيداع). */
  APP_VERSION: z.string().min(1).default("dev"),
  /** الدفع الإلكتروني (كلها اختيارية؛ بلا PAYMENTS_MODE لا مزوّد ولا زر دفع). تُفحص في @masar/payments. */
  PAYMENTS_MODE: optionalText,
  PAYMENTS_PROVIDER: optionalText,
  PAYMENTS_MIN_PAYMENT_MINUTES: optionalText,
  MOYASAR_SECRET_KEY: optionalText,
  MOYASAR_WEBHOOK_SECRET: optionalText,
  PAYMENTS_FAKE_WEBHOOK_SECRET: optionalText,
});

type RawEnv = z.infer<typeof rawSchema>;

function pick<K extends keyof RawEnv>(env: RawEnv, keys: readonly K[]): Pick<RawEnv, K> {
  const entries = keys.map((key) => [key, env[key]] as const);
  return Object.fromEntries(entries) as Pick<RawEnv, K>;
}

const CORE_KEYS = [
  "NODE_ENV",
  "DATABASE_URL",
  "SITE_URL",
  "SITE_INDEXABLE",
  "CHECKOUT_ENABLED",
  "APP_VERSION",
] as const;

/**
 * هل يُسمح بفتح الشراء على رابط عام في الإنتاج؟ فقط مع Moyasar التجريبي وفهرسة مغلقة: معاينة تستقبل
 * إشعارات البيئة التجريبية بلا مال حقيقي (القرار 51، يعدّل القرار 37). الدفع الحي مرفوض في الكود.
 */
function isSandboxPreview(env: { SITE_INDEXABLE: boolean; PAYMENTS: PaymentsConfig }): boolean {
  const { PAYMENTS } = env;
  return PAYMENTS.mode === "test" && PAYMENTS.provider === "moyasar" && !env.SITE_INDEXABLE;
}

const envSchema = rawSchema
  .transform((env, context) => {
    const payments = parsePaymentsConfig(pick(env, PAYMENT_ENV_VARIABLES));
    if (!payments.ok) {
      for (const problem of payments.error) {
        context.addIssue({ code: "custom", path: [problem.variable], message: problem.message });
      }
      return z.NEVER;
    }
    // مفاتيح الدفع لا تبقى حقولًا خامًا في الإعداد: تُحمل داخل PAYMENTS وحده
    return { ...pick(env, CORE_KEYS), PAYMENTS: payments.value };
  })
  .refine((env) => env.NODE_ENV !== "production" || isSecureOrLoopback(env.SITE_URL), {
    path: ["SITE_URL"],
    error: "must use https in production",
  })
  // مزوّد الاختبار محاكاة في ذاكرة العملية: لا يعمل إلا على عنوان الجهاز نفسه، فلا تفعّله معاينة عامة
  .refine(
    (env) =>
      env.PAYMENTS.mode === "off" || env.PAYMENTS.provider !== "fake" || isLoopback(env.SITE_URL),
    {
      path: ["PAYMENTS_PROVIDER"],
      error: "fake is a local simulation: SITE_URL must be a loopback address",
    },
  )
  // لا دفع حيًّا بعد: في الإنتاج يُفتح الشراء على عنوان الجهاز نفسه (اختبار البناء الإنتاجي)، أو على
  // معاينة غير مفهرسة مربوطة بـMoyasar التجريبي. النطاق الرسمي المفهرس لا يستطيع تفعيله.
  .refine(
    (env) =>
      env.NODE_ENV !== "production" ||
      !env.CHECKOUT_ENABLED ||
      isLoopback(env.SITE_URL) ||
      isSandboxPreview(env),
    {
      path: ["CHECKOUT_ENABLED"],
      error: "must stay off in production unless payments run in test mode on a non-indexable site",
    },
  );

export type ServerEnv = z.infer<typeof envSchema>;

export class InvalidEnvError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`Invalid environment configuration:\n- ${problems.join("\n- ")}`);
    this.name = "InvalidEnvError";
  }
}

/**
 * يتحقق من متغيرات البيئة مرة واحدة عند الإقلاع.
 * رسالة الخطأ تذكر اسم المتغير وسبب الرفض فقط — لا قيمته، حتى لا يتسرب سر إلى السجلات.
 */
export function parseEnv(raw: Readonly<Record<string, string | undefined>>): ServerEnv {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    throw new InvalidEnvError(
      result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    );
  }
  return result.data;
}
