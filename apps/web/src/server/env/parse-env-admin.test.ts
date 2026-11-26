import { describe, expect, it } from "vitest";
import { InvalidEnvError, parseEnv } from "./parse-env";

const valid = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  SITE_URL: "https://example.com",
};
const KEY = Buffer.from(Array.from({ length: 32 }, (_, index) => index)).toString("base64");
const REJECTED = "ADMIN_SECRET_KEY: must be exactly 32 bytes in base64 (openssl rand -base64 32)";

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

describe("ADMIN_SECRET_KEY", () => {
  it("غيابه أو فراغه = اللوحة مغلقة، والإقلاع ينجح", () => {
    expect(parseEnv(valid).ADMIN_SECRET_KEY).toBeNull();
    expect(parseEnv({ ...valid, ADMIN_SECRET_KEY: "" }).ADMIN_SECRET_KEY).toBeNull();
  });

  it("32 بايتًا base64 تُفك إلى المفتاح", () => {
    const key = parseEnv({ ...valid, ADMIN_SECRET_KEY: KEY }).ADMIN_SECRET_KEY;
    expect(key).toHaveLength(32);
    expect(Array.from(key ?? [])).toEqual(Array.from({ length: 32 }, (_, index) => index));
  });

  it.each([
    ["أقصر من 32 بايتًا", Buffer.alloc(31, 7).toString("base64")],
    ["أطول من 32 بايتًا", Buffer.alloc(33, 7).toString("base64")],
    ["16 بايتًا", Buffer.alloc(16, 7).toString("base64")],
    ["نص عادي", "change-me"],
    ["hex بدل base64", "a".repeat(64)],
    ["base64url", KEY.replaceAll("+", "-").replaceAll("/", "_").replace("=", "")],
    ["بمسافة في آخره", `${KEY} `],
  ])("%s يرفض الإقلاع", (_name, value) => {
    expect(problemsOf({ ...valid, ADMIN_SECRET_KEY: value })).toEqual([REJECTED]);
  });

  it("رسالة الرفض لا تحمل قيمة المفتاح", () => {
    const secret = "S3cretValueThatMustNotLeak";
    const [problem = ""] = problemsOf({ ...valid, ADMIN_SECRET_KEY: secret });
    expect(problem).not.toContain(secret);
  });
});
