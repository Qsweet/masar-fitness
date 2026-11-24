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

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: postgresUrl,
    /** الرابط العام للموقع بلا شرطة أخيرة، مثل https://example.com */
    SITE_URL: z.url().transform((value) => value.replace(/\/+$/, "")),
    SITE_INDEXABLE: z.string().optional().transform(isSiteIndexable),
    /** يضبطه النشر (رقم الإصدار أو معرّف الإيداع). */
    APP_VERSION: z.string().min(1).default("dev"),
  })
  .refine((env) => env.NODE_ENV !== "production" || isSecureOrLoopback(env.SITE_URL), {
    path: ["SITE_URL"],
    error: "must use https in production",
  });

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
