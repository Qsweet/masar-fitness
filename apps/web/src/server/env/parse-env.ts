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
  MOYASAR_HOSTED_PAGE_ORIGIN: optionalText,
  PAYMENTS_FAKE_WEBHOOK_SECRET: optionalText,
  /** إذن صريح ("yes") لتشغيل مزوّد الاختبار على بناء إنتاجي (اختبارات المتصفح على عنوان الجهاز). */
  PAYMENTS_ALLOW_FAKE: optionalText,
  /** إذن صريح ("yes") لفتح الشراء على معاينة عامة بمفاتيح التجربة. ينتظر موافقة المالك (القرار 54). */
  PAYMENTS_PUBLIC_SANDBOX: optionalText,
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

const EXPLICIT_YES = "yes";

interface CheckedEnv {
  readonly NODE_ENV: RawEnv["NODE_ENV"];
  readonly SITE_URL: string;
  readonly SITE_INDEXABLE: boolean;
  readonly PAYMENTS: PaymentsConfig;
  readonly PAYMENTS_ALLOW_FAKE: boolean;
  readonly PAYMENTS_PUBLIC_SANDBOX: boolean;
}

/**
 * هل يُسمح بفتح الشراء على رابط عام في الإنتاج؟ فقط بإذن صريح `PAYMENTS_PUBLIC_SANDBOX=yes` ومعه
 * Moyasar التجريبي وفهرسة مغلقة. الافتراضي مرفوض: القرار 54 ينتظر موافقة المالك. الدفع الحي مرفوض في الكود.
 */
function isSandboxPreview(env: CheckedEnv): boolean {
  const { PAYMENTS } = env;
  const sandbox = PAYMENTS.mode === "test" && PAYMENTS.provider === "moyasar";
  return env.PAYMENTS_PUBLIC_SANDBOX && sandbox && !env.SITE_INDEXABLE;
}

/**
 * مزوّد الاختبار محاكاة في ذاكرة العملية: عنوان الجهاز نفسه دائمًا، وعلى بناء إنتاجي يلزمه أيضًا إذن
 * صريح `PAYMENTS_ALLOW_FAKE=yes`، فلا يفعّله نشر حقيقي خلف وسيط بخطأ في SITE_URL.
 */
function isFakeAllowed(env: CheckedEnv): boolean {
  if (env.PAYMENTS.mode === "off" || env.PAYMENTS.provider !== "fake") {
    return true;
  }
  return isLoopback(env.SITE_URL) && (env.NODE_ENV !== "production" || env.PAYMENTS_ALLOW_FAKE);
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
    return {
      ...pick(env, CORE_KEYS),
      PAYMENTS: payments.value,
      PAYMENTS_ALLOW_FAKE: env.PAYMENTS_ALLOW_FAKE === EXPLICIT_YES,
      PAYMENTS_PUBLIC_SANDBOX: env.PAYMENTS_PUBLIC_SANDBOX === EXPLICIT_YES,
    };
  })
  .refine((env) => env.NODE_ENV !== "production" || isSecureOrLoopback(env.SITE_URL), {
    path: ["SITE_URL"],
    error: "must use https in production",
  })
  .refine(isFakeAllowed, {
    path: ["PAYMENTS_PROVIDER"],
    error:
      "fake is a local simulation: SITE_URL must be a loopback address, and production builds also need PAYMENTS_ALLOW_FAKE=yes",
  })
  // لا دفع حيًّا بعد: في الإنتاج يُفتح الشراء على عنوان الجهاز نفسه (اختبار البناء الإنتاجي) فقط، إلا
  // بإذن صريح لمعاينة غير مفهرسة مربوطة بـMoyasar التجريبي. النطاق الرسمي المفهرس لا يستطيع تفعيله.
  .refine(
    (env) =>
      env.NODE_ENV !== "production" ||
      !env.CHECKOUT_ENABLED ||
      isLoopback(env.SITE_URL) ||
      isSandboxPreview(env),
    {
      path: ["CHECKOUT_ENABLED"],
      error:
        "must stay off in production: a public sandbox preview needs PAYMENTS_PUBLIC_SANDBOX=yes, Moyasar test mode and SITE_INDEXABLE off",
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
