import { describe, expect, it } from "vitest";
import { InvalidEnvError, parseEnv } from "./parse-env";

/** متغيرات المكتبة (ADMIN_A3_SLIDER §6.4): الرفع مطفأ افتراضيًا ويشترط مجلدًا مطلقًا. */
const valid = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  SITE_URL: "https://example.com",
};

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

describe("MEDIA_DIR و MEDIA_UPLOADS و BACKUP_CONFIGURED و BACKUP_STATUS_DIR", () => {
  it("بلا قيم: لا مجلد، والرفع مطفأ، ولا نسخ احتياطي معلن", () => {
    expect(parseEnv(valid)).toMatchObject({
      MEDIA_DIR: null,
      MEDIA_UPLOADS: false,
      BACKUP_CONFIGURED: false,
    });
  });

  it("الرفع بـyes حرفيًا ومعه مجلد مطلق", () => {
    const env = parseEnv({ ...valid, MEDIA_DIR: "/var/lib/masar/media", MEDIA_UPLOADS: "yes" });
    expect(env).toMatchObject({ MEDIA_DIR: "/var/lib/masar/media", MEDIA_UPLOADS: true });
    expect(parseEnv({ ...valid, MEDIA_DIR: "/m", MEDIA_UPLOADS: "true" }).MEDIA_UPLOADS).toBe(
      false,
    );
    expect(parseEnv({ ...valid, BACKUP_CONFIGURED: "yes" }).BACKUP_CONFIGURED).toBe(true);
  });

  it("مجلد سجل النسخ الآلي: غيابه null، والمطلق يُقبل، والنسبي يرفض الإقلاع", () => {
    expect(parseEnv(valid).BACKUP_STATUS_DIR).toBeNull();
    expect(parseEnv({ ...valid, BACKUP_STATUS_DIR: "" }).BACKUP_STATUS_DIR).toBeNull();
    expect(
      parseEnv({ ...valid, BACKUP_STATUS_DIR: "/var/lib/masar/backup" }).BACKUP_STATUS_DIR,
    ).toBe("/var/lib/masar/backup");
    expect(problemsOf({ ...valid, BACKUP_STATUS_DIR: "backup" })).toEqual([
      "BACKUP_STATUS_DIR: must be an absolute path",
    ]);
  });

  it("مسار نسبي أو رفع بلا مجلد يرفضان الإقلاع", () => {
    expect(problemsOf({ ...valid, MEDIA_DIR: "media" })).toEqual([
      "MEDIA_DIR: must be an absolute path",
    ]);
    expect(problemsOf({ ...valid, MEDIA_UPLOADS: "yes" })).toEqual([
      "MEDIA_UPLOADS: needs MEDIA_DIR: uploaded images are written there",
    ]);
  });
});
