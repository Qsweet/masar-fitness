import { describe, expect, it } from "vitest";
import {
  addClickIds,
  decodeAttribution,
  encodeAttribution,
  mergeAttribution,
  touchFromQuery,
} from "./attribution";
import {
  CONSENT_VERSION,
  consentAllows,
  encodeConsent,
  googleConsentState,
  parseConsent,
} from "./consent";
import { majorAmount, majorNumber, pixelEventName, purchaseEventId } from "./events";
import {
  fbcFromClickId,
  gaClientId,
  metaCookie,
  phoneDigitsForHash,
  phoneE164ForHash,
  vendorCookie,
} from "./identifiers";
import { isCompleteConfig, parseIntegrationConfig } from "./ids";
import { isServerProvider, providerCategories, TRACKING_PROVIDERS } from "./providers";

describe("المنصات والفئات", () => {
  it("GTM بأي فئة، وGA4 تحليلات، والبقية إعلانات", () => {
    expect(providerCategories("gtm")).toEqual(["analytics", "ads"]);
    expect(providerCategories("ga4")).toEqual(["analytics"]);
    for (const provider of ["google_ads", "meta", "snap", "tiktok"] as const) {
      expect(providerCategories(provider)).toEqual(["ads"]);
    }
  });

  it("الخادمية أربع: لا Google Ads ولا GTM", () => {
    expect(TRACKING_PROVIDERS.filter(isServerProvider)).toEqual(["ga4", "meta", "snap", "tiktok"]);
  });
});

describe("المعرّفات العامة", () => {
  const valid = {
    gtm: { containerId: "GTM-AB12CD3" },
    ga4: { measurementId: "G-1A2B3C4D5E" },
    google_ads: { conversionId: "AW-123456789", conversionLabel: "AbC-dEf_123" },
    meta: { pixelId: "123456789012345" },
    snap: { pixelId: "0b1f7c2e-1234-4abc-9def-0123456789ab" },
    tiktok: { pixelId: "C1ABCDEFGHIJ2KLMNOPQ" },
  } as const;

  it.each(TRACKING_PROVIDERS)("%s: المعرّف الصحيح يُقبل ويكمل الإعداد", (provider) => {
    const parsed = parseIntegrationConfig(provider, valid[provider], true);
    expect(parsed.issues).toEqual({});
    expect(isCompleteConfig(provider, parsed.config)).toBe(true);
  });

  it("ما يحمل محارف تكسر رابطًا أو CSP يُرفض ولا يُصلَح", () => {
    const evil = parseIntegrationConfig("gtm", { containerId: "GTM-X'; script-src *" }, false);
    expect(evil.issues).toEqual({ containerId: "invalid" });
    expect(evil.config).toEqual({});
    expect(parseIntegrationConfig("meta", { pixelId: "12ab" }, false).issues).toEqual({
      pixelId: "invalid",
    });
    expect(parseIntegrationConfig("snap", { pixelId: "123456789012345" }, false).issues).toEqual({
      pixelId: "invalid",
    });
  });

  it("الفارغ مسموح بلا تفعيل ومطلوب معه، والحقول الغريبة تُسقط", () => {
    expect(parseIntegrationConfig("google_ads", {}, false).issues).toEqual({});
    expect(
      parseIntegrationConfig("google_ads", { conversionId: "AW-123456" }, true).issues,
    ).toEqual({ conversionLabel: "required" });
    const extra = parseIntegrationConfig(
      "ga4",
      { measurementId: "G-ABCD1234", pixelId: "1" },
      true,
    );
    expect(extra.config).toEqual({ measurementId: "G-ABCD1234" });
  });
});

describe("الموافقة", () => {
  const consent = { analytics: true, ads: false, version: CONSENT_VERSION, at: 1_800_000_000 };

  it("ترميز وفك بلا فقد، والنسخة القديمة أو المشوّهة تعني لا موافقة", () => {
    expect(encodeConsent(consent)).toBe("v1.a1.m0.1800000000");
    expect(parseConsent(encodeConsent(consent))).toEqual(consent);
    expect(parseConsent("v0.a1.m1.1800000000")).toBeNull();
    expect(parseConsent("v1.a1.m1")).toBeNull();
    expect(parseConsent(undefined)).toBeNull();
  });

  it("الوسم بفئته، وGTM بالفئتين معًا، ولا شيء بلا موافقة", () => {
    expect(consentAllows("ga4", consent)).toBe(true);
    expect(consentAllows("meta", consent)).toBe(false);
    expect(consentAllows("gtm", consent)).toBe(false);
    expect(consentAllows("gtm", { ...consent, ads: true })).toBe(true);
    expect(consentAllows("gtm", null)).toBe(false);
  });

  it("Consent Mode: الإعلانات تفتح ثلاثة، والتحليلات واحدًا، والافتراضي رفض", () => {
    expect(googleConsentState(consent)).toEqual({
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "granted",
    });
    expect(Object.values(googleConsentState(null))).toEqual(Array(4).fill("denied"));
  });
});

describe("الإسناد", () => {
  const query = (values: Record<string, string>) => (name: string) => values[name] ?? null;

  it("بلا موافقة الإعلانات: الحملة وصفحة الهبوط وحدهما، ولا معرّف نقر", () => {
    const values = { gclid: "Cj0KCQ_abc-123", utm_source: "snapchat", x: "1" };
    expect(
      touchFromQuery(query(values), 100, { clickIds: false, landing: "/memberships" }),
    ).toEqual({
      values: { utm_source: "snapchat" },
      at: 100,
      landing: "/memberships",
    });
    expect(touchFromQuery(query({ fbclid: "IwAR2F4" }), 1)).toBeNull();
  });

  it("مع الموافقة: معرّفات النقر أيضًا، وما خالف النمط يُسقط", () => {
    const touch = touchFromQuery(
      query({ gclid: "Cj0KCQ_abc-123", utm_source: "snapchat", ttclid: "bad value<>" }),
      100,
      { clickIds: true, landing: "/bad path" },
    );
    expect(touch).toEqual({ values: { gclid: "Cj0KCQ_abc-123", utm_source: "snapchat" }, at: 100 });
    expect(touchFromQuery(query({ utm_source: "" }), 1, { clickIds: true })).toBeNull();
  });

  it("معرّفات النقر بعد الموافقة تُضاف إلى آخر لمسة بلا مسّ الأولى", () => {
    const first = { values: { utm_source: "snap" }, at: 1, landing: "/" };
    const clicks = { values: { ScCid: "7b3a7917" }, at: 5 };
    expect(addClickIds({ first, last: first }, clicks)).toEqual({
      first,
      last: { values: { utm_source: "snap", ScCid: "7b3a7917" }, at: 1, landing: "/" },
    });
    expect(addClickIds(null, clicks)).toEqual({ first: clicks, last: clicks });
  });

  it("أول لمسة ثابتة وآخر لمسة تُحدَّث، والكوكي يُفك بالفحص نفسه", () => {
    const first = { values: { fbclid: "IwAR2F4" }, at: 1 };
    const last = { values: { ScCid: "7b3a7917-a82a" }, at: 2 };
    const merged = mergeAttribution(mergeAttribution(null, first), last);
    expect(merged).toEqual({ first, last });
    expect(decodeAttribution(encodeAttribution(merged))).toEqual(merged);
    const forged = encodeURIComponent(
      JSON.stringify({ first: { values: { gclid: "<script>" }, at: 1 }, last }),
    );
    expect(decodeAttribution(forged)).toBeNull();
    expect(decodeAttribution("%E0%A4%A")).toBeNull();
  });
});

describe("الأحداث والمبالغ", () => {
  it("أسماء كل منصة، ومعرّف الشراء من الطلب", () => {
    expect(pixelEventName("meta", "purchase")).toBe("Purchase");
    expect(pixelEventName("snap", "add_to_cart")).toBe("ADD_CART");
    expect(pixelEventName("tiktok", "purchase")).toBe("CompletePayment");
    expect(purchaseEventId("0193")).toBe("purchase.0193");
  });

  it("الهللات إلى ريال بلا قسمة عشرية", () => {
    expect(majorAmount(149_950)).toBe("1499.50");
    expect(majorAmount(5)).toBe("0.05");
    expect(majorAmount(-120)).toBe("-1.20");
    expect(majorNumber(149_950)).toBe(1499.5);
  });
});

describe("التطبيع والكوكيات", () => {
  it("الجوال: أرقام بلا + لميتا وسناب، وE.164 لجوجل وتيك توك", () => {
    expect(phoneDigitsForHash("+966512345678")).toBe("966512345678");
    expect(phoneE164ForHash("+966512345678")).toBe("+966512345678");
    expect(phoneDigitsForHash("0512345678")).toBeNull();
  });

  it("كوكيات المنصات بصيغتها، وما سواها لا يُرسل", () => {
    expect(gaClientId("GA1.1.1234567890.1700000000")).toBe("1234567890.1700000000");
    expect(gaClientId("GA1.1.x")).toBeNull();
    expect(metaCookie("fb.1.1554763741205.AbCdEf123")).toBe("fb.1.1554763741205.AbCdEf123");
    expect(metaCookie("fb.1.x.y")).toBeNull();
    expect(fbcFromClickId("IwAR2F4", 1_554_763_741_205)).toBe("fb.1.1554763741205.IwAR2F4");
    expect(vendorCookie("a1b2c3d4-e5f6")).toBe("a1b2c3d4-e5f6");
    expect(vendorCookie("bad;cookie")).toBeNull();
  });
});
