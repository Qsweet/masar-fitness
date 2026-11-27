import { describe, expect, it } from "vitest";
import { mayShareHashedPhone } from "./phone-share";

const ads = {
  provider: "google_ads",
  config: { conversionId: "AW-123456", conversionLabel: "AbCd12" },
} as const;
const meta = { provider: "meta", config: { pixelId: "123456789012345" } } as const;
const tiktok = { provider: "tiktok", config: { pixelId: "C1ABCDEFGHIJ2KLMNOPQ" } } as const;

describe("الجوال المجزّأ في صفحة الطلب", () => {
  it("فقط لـGoogle Ads بتسمية أو TikTok، وبموافقة الإعلانات الآن ولحظة الشراء", () => {
    expect(mayShareHashedPhone({ requestAds: true, orderAds: true, providers: [ads] })).toBe(true);
    expect(mayShareHashedPhone({ requestAds: true, orderAds: true, providers: [tiktok] })).toBe(
      true,
    );
    expect(mayShareHashedPhone({ requestAds: true, orderAds: true, providers: [meta] })).toBe(
      false,
    );
    expect(
      mayShareHashedPhone({
        requestAds: true,
        orderAds: true,
        providers: [{ provider: "google_ads", config: { conversionId: "AW-123456" } }],
      }),
    ).toBe(false);
    expect(mayShareHashedPhone({ requestAds: false, orderAds: true, providers: [ads] })).toBe(
      false,
    );
    expect(mayShareHashedPhone({ requestAds: true, orderAds: false, providers: [ads] })).toBe(
      false,
    );
  });
});
