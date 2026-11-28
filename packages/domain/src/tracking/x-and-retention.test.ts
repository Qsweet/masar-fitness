import { describe, expect, it } from "vitest";
import { touchFromQuery } from "./attribution";
import { isCompleteConfig, parseIntegrationConfig, sendsHashedPhone } from "./ids";
import { isServerProvider, providerCategories, usesHashedPhone } from "./providers";
import { retentionCutoff, TRACKING_RETENTION_DAYS } from "./retention";

describe("X (القرار 90-1)", () => {
  it("منصة إعلانات في المتصفح وحده", () => {
    expect(providerCategories("x")).toEqual(["ads"]);
    expect(isServerProvider("x")).toBe(false);
  });

  it("البكسل وحدث الشراء مطلوبان مع التفعيل، والسلة والاستفسار اختياريان", () => {
    expect(parseIntegrationConfig("x", { pixelId: "o8z5x" }, true).issues).toEqual({
      purchaseEventId: "required",
    });
    const full = parseIntegrationConfig(
      "x",
      {
        pixelId: "o8z5x",
        purchaseEventId: "tw-o8z5x-p1q2r",
        addToCartEventId: "TW-O8Z5X-a1b2c",
        leadEventId: "",
      },
      true,
    );
    expect(full.issues).toEqual({});
    expect(full.config).toEqual({
      pixelId: "o8z5x",
      purchaseEventId: "tw-o8z5x-p1q2r",
      addToCartEventId: "TW-O8Z5X-a1b2c",
    });
    expect(isCompleteConfig("x", full.config)).toBe(true);
  });

  it("المعرّف بنمطه الصارم، وحدث لبكسل آخر مرفوض", () => {
    const parsed = parseIntegrationConfig(
      "x",
      {
        pixelId: "o8z5x'",
        purchaseEventId: "tw-o8z5x-p1q2",
        leadEventId: "tw-zzzzz-p1q2r",
      },
      false,
    );
    expect(parsed.issues).toEqual({ pixelId: "invalid", purchaseEventId: "invalid" });
    expect(
      parseIntegrationConfig("x", { pixelId: "o8z5x", leadEventId: "tw-zzzzz-p1q2r" }, false)
        .issues,
    ).toEqual({ leadEventId: "pixel_mismatch" });
    expect(isCompleteConfig("x", { pixelId: "o8z5x", purchaseEventId: "tw-aaaaa-p1q2r" })).toBe(
      false,
    );
  });

  it("twclid معرّف نقر: مع موافقة الإعلانات وحدها", () => {
    const read = (name: string) => (name === "twclid" ? "26ab3x9kq0" : null);
    expect(touchFromQuery(read, 1)).toBeNull();
    expect(touchFromQuery(read, 1, { clickIds: true })).toEqual({
      values: { twclid: "26ab3x9kq0" },
      at: 1,
    });
  });
});

describe("الجوال المجزّأ لكل منصة (القرار 90-3)", () => {
  it("مفعَّل افتراضيًا لمن يقبله، ويُطفأ بالإعداد", () => {
    for (const provider of ["google_ads", "meta", "snap", "tiktok", "x"] as const) {
      expect(sendsHashedPhone(provider, {})).toBe(true);
      expect(sendsHashedPhone(provider, { sendHashedPhone: false })).toBe(false);
    }
    expect(usesHashedPhone("ga4")).toBe(false);
    expect(sendsHashedPhone("gtm", { sendHashedPhone: true })).toBe(false);
  });
});

describe("الاحتفاظ (القرار 90-6)", () => {
  it("90 يومًا من الآن بالضبط", () => {
    expect(TRACKING_RETENTION_DAYS).toBe(90);
    expect(retentionCutoff(new Date("2026-04-01T00:00:00Z")).toISOString()).toBe(
      "2026-01-01T00:00:00.000Z",
    );
  });
});
