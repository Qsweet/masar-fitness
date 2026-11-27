import { describe, expect, it } from "vitest";
import { InvalidEnvError, parseEnv } from "./parse-env";

const base = { NODE_ENV: "production", DATABASE_URL: "postgresql://u:p@localhost:5432/db" };

describe("TRACKING_TRANSPORT", () => {
  it("غيابه = الإرسال الحقيقي (حين يفعّل المالك منصة)", () => {
    expect(parseEnv({ ...base, SITE_URL: "https://example.com" }).TRACKING_TRANSPORT).toBe("live");
  });

  it("fake على عنوان الجهاز وحده، وقيمة أخرى مرفوضة", () => {
    expect(
      parseEnv({ ...base, SITE_URL: "http://127.0.0.1:3100", TRACKING_TRANSPORT: "fake" })
        .TRACKING_TRANSPORT,
    ).toBe("fake");
    expect(() =>
      parseEnv({ ...base, SITE_URL: "https://example.com", TRACKING_TRANSPORT: "fake" }),
    ).toThrow(InvalidEnvError);
    expect(() =>
      parseEnv({ ...base, SITE_URL: "https://example.com", TRACKING_TRANSPORT: "maybe" }),
    ).toThrow(InvalidEnvError);
  });
});
