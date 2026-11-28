import { describe, expect, it } from "vitest";
import { browserShare } from "./browser-share";

const ads = {
  provider: "google_ads",
  config: { conversionId: "AW-123456", conversionLabel: "AbCd12" },
} as const;
const meta = { provider: "meta", config: { pixelId: "123456789012345" } } as const;
const tiktok = { provider: "tiktok", config: { pixelId: "C1ABCDEFGHIJ2KLMNOPQ" } } as const;
const x = {
  provider: "x",
  config: { pixelId: "o8z5x", purchaseEventId: "tw-o8z5x-p1q2r" },
} as const;
const consented = { requestAds: true, orderAds: true } as const;

describe("معرّفات صفحة الطلب إلى المتصفح", () => {
  it("الجوال فقط لـGoogle Ads بتسمية أو TikTok أو X، وبموافقة الإعلانات الآن ولحظة الشراء", () => {
    for (const provider of [ads, tiktok, x]) {
      expect(browserShare({ ...consented, providers: [provider] }).phone).toBe(true);
    }
    expect(browserShare({ ...consented, providers: [meta] })).toEqual({
      phone: false,
      twclid: false,
    });
    const noLabel = { provider: "google_ads", config: { conversionId: "AW-123456" } } as const;
    expect(browserShare({ ...consented, providers: [noLabel] }).phone).toBe(false);
    expect(browserShare({ requestAds: false, orderAds: true, providers: [ads] }).phone).toBe(false);
    expect(browserShare({ requestAds: true, orderAds: false, providers: [x] })).toEqual({
      phone: false,
      twclid: false,
    });
  });

  it("مفتاح المنصة المطفأ يحجب جوالها، وtwclid لـX وحدها (القرار 90)", () => {
    const off = { sendHashedPhone: false } as const;
    const xOff = { ...x, config: { ...x.config, ...off } };
    expect(browserShare({ ...consented, providers: [xOff] })).toEqual({
      phone: false,
      twclid: true,
    });
    const adsOff = { ...ads, config: { ...ads.config, ...off } };
    expect(browserShare({ ...consented, providers: [adsOff, tiktok] }).phone).toBe(true);
    expect(browserShare({ ...consented, providers: [adsOff] }).phone).toBe(false);
    expect(browserShare({ ...consented, providers: [tiktok] }).twclid).toBe(false);
  });
});
