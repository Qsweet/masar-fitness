import { sealSecret } from "@masar/db";
import { TEST_ADMIN_KEY } from "@masar/db/test-support";
import { describe, expect, it } from "vitest";
import { openPreview, previewCookieName, sealPreview } from "./preview-cookie";

/** فتح كوكي المعاينة (ADMIN_A3_CONTENT §11، WP5): المنتهي، والسياق الآخر، والمعبوث به. */
const STAFF = "018f4e2a-0000-7000-8000-000000000001";
const RELEASE = "018f4e2a-0000-7000-8000-0000000000aa";
const NOW = new Date("2026-11-28T10:00:00Z");
const MINUTE_MS = 60_000;
const at = (minutes: number) => new Date(NOW.getTime() + minutes * MINUTE_MS);

describe("كوكي المعاينة", () => {
  it("يُفتح بهدفه وموظفه خلال ثلاثين دقيقة، ولا بعدها", () => {
    const draft = sealPreview(TEST_ADMIN_KEY, { staffId: STAFF, target: "draft" }, NOW);
    expect(openPreview(TEST_ADMIN_KEY, draft, at(29))).toEqual({ staffId: STAFF, target: "draft" });
    expect(openPreview(TEST_ADMIN_KEY, draft, at(30))).toBeNull();
    const release = sealPreview(TEST_ADMIN_KEY, { staffId: STAFF, target: RELEASE }, NOW);
    expect(openPreview(TEST_ADMIN_KEY, release, NOW)?.target).toBe(RELEASE);
  });

  it("قيمة مختومة لسياق آخر (رمز نشر أو سر TOTP) لا تُقبل", () => {
    const payload = JSON.stringify({ staffId: STAFF, target: "draft", exp: at(10).getTime() });
    const other = sealSecret(
      TEST_ADMIN_KEY,
      new TextEncoder().encode(payload),
      `content-publish:${STAFF}`,
    );
    expect(openPreview(TEST_ADMIN_KEY, other, NOW)).toBeNull();
  });

  it("المعبوث به والفارغ والطويل والهدف بغير شكله مرفوضة", () => {
    const valid = sealPreview(TEST_ADMIN_KEY, { staffId: STAFF, target: "draft" }, NOW);
    expect(openPreview(TEST_ADMIN_KEY, `${valid.slice(0, -2)}AA`, NOW)).toBeNull();
    expect(openPreview(TEST_ADMIN_KEY, "", NOW)).toBeNull();
    expect(openPreview(TEST_ADMIN_KEY, "a".repeat(700), NOW)).toBeNull();
    const payload = JSON.stringify({ staffId: STAFF, target: "../etc", exp: at(10).getTime() });
    const shaped = sealSecret(TEST_ADMIN_KEY, new TextEncoder().encode(payload), "content-preview");
    expect(openPreview(TEST_ADMIN_KEY, shaped, NOW)).toBeNull();
  });

  it("الاسم بالبادئة على https وحده", () => {
    expect(previewCookieName("https://example.com")).toBe("__Host-masar_preview");
    expect(previewCookieName("http://127.0.0.1:3103")).toBe("masar_preview");
  });
});
