import { describe, expect, it } from "vitest";
import { InvalidEnvError, parseEnv } from "./parse-env";

const valid = {
  DATABASE_URL: "postgresql://user:s3cret-pass@db.internal:5432/masar",
  SITE_URL: "https://example.com/",
};

const CHECKOUT_OFF =
  "CHECKOUT_ENABLED: must stay off in production: a public sandbox preview needs PAYMENTS_PUBLIC_SANDBOX=yes, Moyasar test mode and SITE_INDEXABLE off";

function problemsOf(raw: Record<string, string | undefined>): readonly string[] {
  try {
    parseEnv(raw);
  } catch (error) {
    if (error instanceof InvalidEnvError) {
      return error.problems;
    }
    throw error;
  }
  throw new Error("expected parseEnv to throw");
}

describe("parseEnv", () => {
  it("يقبل الإعداد الصحيح ويطبّق القيم الافتراضية", () => {
    expect(parseEnv(valid)).toEqual({
      NODE_ENV: "development",
      DATABASE_URL: valid.DATABASE_URL,
      SITE_URL: "https://example.com",
      SITE_INDEXABLE: false,
      CHECKOUT_ENABLED: false,
      APP_VERSION: "dev",
      PAYMENTS: { mode: "off" },
      PAYMENTS_ALLOW_FAKE: false,
      PAYMENTS_PUBLIC_SANDBOX: false,
    });
  });

  it("الفهرسة مغلقة إلا بالقيمة true حرفيًا", () => {
    for (const value of [undefined, "", "false", "1", "TRUE", "yes"]) {
      expect(parseEnv({ ...valid, SITE_INDEXABLE: value }).SITE_INDEXABLE).toBe(false);
    }
    expect(parseEnv({ ...valid, SITE_INDEXABLE: "true" }).SITE_INDEXABLE).toBe(true);
  });

  it("الشراء الإلكتروني مغلق إلا بالقيمة true حرفيًا", () => {
    for (const value of [undefined, "", "false", "1", "TRUE", "yes"]) {
      expect(parseEnv({ ...valid, CHECKOUT_ENABLED: value }).CHECKOUT_ENABLED).toBe(false);
    }
    expect(parseEnv({ ...valid, CHECKOUT_ENABLED: "true" }).CHECKOUT_ENABLED).toBe(true);
  });

  it("يرفض فتح الشراء في الإنتاج على رابط عام", () => {
    expect(problemsOf({ ...valid, NODE_ENV: "production", CHECKOUT_ENABLED: "true" })).toEqual([
      CHECKOUT_OFF,
    ]);
    // مغلقًا يمر الإنتاج العام كما هو
    expect(parseEnv({ ...valid, NODE_ENV: "production" }).CHECKOUT_ENABLED).toBe(false);
  });

  it("يقبل فتح الشراء في الإنتاج على عنوان الجهاز نفسه (اختبار البناء الإنتاجي)", () => {
    const local = {
      ...valid,
      SITE_URL: "http://127.0.0.1:3101",
      NODE_ENV: "production",
      CHECKOUT_ENABLED: "true",
    };
    expect(parseEnv(local).CHECKOUT_ENABLED).toBe(true);
    // اسم يشبه العنوان المحلي لكنه نطاق عام: مرفوض
    expect(problemsOf({ ...local, SITE_URL: "https://localhost.example.com" })).toEqual([
      CHECKOUT_OFF,
    ]);
  });

  it("يرفض غياب المتغيرات المطلوبة ويسمّيها", () => {
    const problems = problemsOf({});
    expect(problems.some((line) => line.startsWith("DATABASE_URL:"))).toBe(true);
    expect(problems.some((line) => line.startsWith("SITE_URL:"))).toBe(true);
  });

  it("يرفض رابط قاعدة بيانات ليس PostgreSQL", () => {
    expect(problemsOf({ ...valid, DATABASE_URL: "mysql://u:p@h/db" })).toEqual([
      "DATABASE_URL: must be a postgres:// URL",
    ]);
  });

  it("يشترط https في الإنتاج فقط", () => {
    const insecure = { ...valid, SITE_URL: "http://example.com" };
    expect(parseEnv(insecure).SITE_URL).toBe("http://example.com");
    expect(problemsOf({ ...insecure, NODE_ENV: "production" })).toEqual([
      "SITE_URL: must use https in production",
    ]);
  });

  it("يستثني عنوان الجهاز نفسه من شرط https (اختبار البناء الإنتاجي محليًا)", () => {
    for (const SITE_URL of [
      "http://127.0.0.1:3100",
      "http://localhost:3000",
      "http://[::1]:3000",
    ]) {
      expect(parseEnv({ ...valid, SITE_URL, NODE_ENV: "production" }).SITE_URL).toBe(SITE_URL);
    }
    // اسم يشبه العنوان المحلي لكنه نطاق عام: لا استثناء
    expect(
      problemsOf({ ...valid, SITE_URL: "http://localhost.example.com", NODE_ENV: "production" }),
    ).toEqual(["SITE_URL: must use https in production"]);
  });

  it("يرفض أي بروتوكول غير http(s) حتى على عنوان الجهاز نفسه", () => {
    for (const SITE_URL of ["ftp://localhost", "ws://127.0.0.1:3000", "javascript://localhost"]) {
      expect(problemsOf({ ...valid, SITE_URL, NODE_ENV: "production" })).toEqual([
        "SITE_URL: must be an http(s) URL",
      ]);
    }
  });

  it("لا يسرّب قيمة أي متغير في رسالة الخطأ", () => {
    const secretUrl = "mysql://user:s3cret-pass@db.internal/masar";
    try {
      parseEnv({ ...valid, DATABASE_URL: secretUrl, NODE_ENV: "staging" });
      throw new Error("expected parseEnv to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidEnvError);
      expect((error as Error).message).not.toContain("s3cret-pass");
      expect((error as Error).message).not.toContain("db.internal");
    }
  });
});
