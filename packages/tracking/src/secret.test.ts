import { describe, expect, it } from "vitest";
import {
  deriveTrackingKey,
  isPlausibleSecret,
  openTrackingSecret,
  sealTrackingSecret,
} from "./secret";

const KEY = new Uint8Array(Array.from({ length: 32 }, (_, index) => index));
const OTHER = new Uint8Array(32).fill(7);
const CLUB = "0193a1b2-0000-7000-8000-000000000001";

describe("المفتاح الخادمي المشفّر", () => {
  it("يُفك بالنادي والمنصة نفسيهما وحدهما، وآخر أربعة للعرض", () => {
    const sealed = sealTrackingSecret(KEY, CLUB, "meta", "EAAB-secret-token-WXYZ");
    expect(sealed.last4).toBe("WXYZ");
    expect(sealed.sealed).not.toContain("secret");
    expect(openTrackingSecret(KEY, CLUB, "meta", sealed.sealed)).toBe("EAAB-secret-token-WXYZ");
    expect(openTrackingSecret(KEY, CLUB, "snap", sealed.sealed)).toBeNull();
    expect(
      openTrackingSecret(KEY, "0193a1b2-0000-7000-8000-000000000002", "meta", sealed.sealed),
    ).toBeNull();
    expect(openTrackingSecret(OTHER, CLUB, "meta", sealed.sealed)).toBeNull();
  });

  it("المفتاح الفرعي غير مفتاح اللوحة", () => {
    expect(Buffer.from(deriveTrackingKey(KEY)).equals(Buffer.from(KEY))).toBe(false);
    expect(deriveTrackingKey(KEY)).toHaveLength(32);
  });

  it("شكل المفتاح: ASCII ظاهر بلا مسافة", () => {
    expect(isPlausibleSecret("EAAB-secret_token.123")).toBe(true);
    expect(isPlausibleSecret("short")).toBe(false);
    expect(isPlausibleSecret("has space inside")).toBe(false);
    expect(isPlausibleSecret("سر عربي طويل")).toBe(false);
  });
});
