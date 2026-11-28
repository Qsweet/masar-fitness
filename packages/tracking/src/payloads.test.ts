import type { PurchaseContext } from "@masar/db";
import { describe, expect, it } from "vitest";
import { leaseFor } from "./dispatch";
import { sha256Hex } from "./hash";
import { TRANSPORT_TIMEOUT_MS } from "./transport";
import { buildPurchase, buildTest, interpret, type Built, type PurchaseInput } from "./payloads";

const PHONE = "+966512345678";
const purchase: PurchaseContext = {
  orderId: "0193a1b2-0000-7000-8000-000000000001",
  reference: "MSR-0000042",
  customerId: "0193a1b2-0000-7000-8000-0000000000aa",
  phoneE164: PHONE,
  locale: "ar",
  totalMinor: 149_950,
  currency: "SAR",
  paidAt: new Date("2026-11-20T09:00:00Z"),
  items: [{ slug: "six-months", nameAr: "ستة أشهر", nameEn: "Six months", totalMinor: 149_950 }],
  consentAnalytics: true,
  consentAds: true,
  firstTouch: { values: { fbclid: "IwAR2F4", ScCid: "7b3a7917" }, at: 1_763_000_000 },
  lastTouch: { values: { ttclid: "E.C.P.abc" }, at: 1_763_100_000 },
  gaClientId: "1234567890.1700000000",
  fbp: "fb.1.1700000000000.987654321",
  fbc: null,
  scid: "a1b2c3d4-e5f6-7788",
  ttp: "ttp-cookie-value-1",
  obref: null,
  clientIp: "203.0.113.9",
  userAgent: "Mozilla/5.0 Test",
  pageUrl: "https://masar.test/checkout/six-months",
  purgedAt: null,
};

const base: Omit<PurchaseInput, "config"> = {
  purchase,
  eventId: `purchase.${purchase.orderId}`,
  secret: "server-token-1234",
  siteUrl: "https://masar.test",
};

function request(built: Built) {
  if (built.kind !== "request") {
    throw new Error(`لم يُبنَ: ${built.reason}`);
  }
  return { ...built.request, json: JSON.parse(built.request.body) as Record<string, unknown> };
}

describe("التجزئة", () => {
  it("مثال سناب الرسمي: 448444124653 ← dc008fda…", () => {
    expect(sha256Hex("448444124653")).toBe(
      "dc008fda46e2e64002cf2f82a4906236282d431c4f75e5b60bfe79fc48546383",
    );
  });
});

describe("بانيات الشراء", () => {
  it("GA4: transaction_id بالمرجع، والقيمة بالريال، والموافقة من الطلب، والسر في الرابط وحده", () => {
    const built = request(
      buildPurchase("ga4", { ...base, config: { measurementId: "G-ABC1234" } }),
    );
    expect(built.url).toBe(
      "https://www.google-analytics.com/mp/collect?measurement_id=G-ABC1234&api_secret=server-token-1234",
    );
    expect(built.json).toMatchObject({
      client_id: "1234567890.1700000000",
      timestamp_micros: purchase.paidAt.getTime() * 1000,
      consent: { ad_user_data: "GRANTED", ad_personalization: "GRANTED" },
      events: [
        {
          name: "purchase",
          params: { transaction_id: "MSR-0000042", value: 1499.5, currency: "SAR" },
        },
      ],
    });
    expect(built.body).not.toContain(PHONE);
  });

  it("GA4 بلا كوكي _ga لا يُرسل", () => {
    const built = buildPurchase("ga4", {
      ...base,
      purchase: { ...purchase, gaClientId: null },
      config: { measurementId: "G-ABC1234" },
    });
    expect(built).toEqual({ kind: "skip", reason: "no_client_id" });
  });

  it("ميتا: Purchase بمعرّف الحدث، والجوال أرقامًا بلا + مجزّأً، وfbc من fbclid", () => {
    const built = request(
      buildPurchase("meta", { ...base, config: { pixelId: "123456789012345" } }),
    );
    expect(built.url).toBe(
      "https://graph.facebook.com/v27.0/123456789012345/events?access_token=server-token-1234",
    );
    const [event] = built.json.data as Record<string, unknown>[];
    expect(event).toMatchObject({
      event_name: "Purchase",
      event_id: base.eventId,
      action_source: "website",
      event_time: Math.floor(purchase.paidAt.getTime() / 1000),
      event_source_url: purchase.pageUrl,
      user_data: {
        ph: [sha256Hex("966512345678")],
        external_id: [sha256Hex(purchase.customerId)],
        client_ip_address: "203.0.113.9",
        fbc: "fb.1.1763000000000.IwAR2F4",
        fbp: purchase.fbp,
      },
      custom_data: { currency: "SAR", value: 1499.5, order_id: "MSR-0000042" },
    });
    expect(built.json).not.toHaveProperty("test_event_code");
    expect(built.body).not.toContain("966512345678");
  });

  it("سناب: PURCHASE وWEB، وsc_click_id من ScCid وsc_cookie1 من _scid", () => {
    const built = request(
      buildPurchase("snap", {
        ...base,
        config: { pixelId: "0b1f7c2e-1234-4abc-9def-0123456789ab" },
      }),
    );
    expect(built.url).toBe(
      "https://tr.snapchat.com/v3/0b1f7c2e-1234-4abc-9def-0123456789ab/events?access_token=server-token-1234",
    );
    const [event] = built.json.data as Record<string, unknown>[];
    expect(event).toMatchObject({
      event_name: "PURCHASE",
      action_source: "WEB",
      user_data: {
        ph: [sha256Hex("966512345678")],
        sc_click_id: "7b3a7917",
        sc_cookie1: purchase.scid,
      },
      custom_data: { order_id: "MSR-0000042", currency: "SAR", value: 1499.5 },
    });
  });

  it("تيك توك: CompletePayment بترويسة Access-Token، والجوال E.164 بـ+ مجزّأً", () => {
    const built = request(
      buildPurchase("tiktok", { ...base, config: { pixelId: "C1ABCDEFGHIJ2KLMNOPQ" } }),
    );
    expect(built.url).toBe("https://business-api.tiktok.com/open_api/v1.3/event/track/");
    expect(built.headers["Access-Token"]).toBe("server-token-1234");
    expect(built.json).toMatchObject({
      event_source: "web",
      event_source_id: "C1ABCDEFGHIJ2KLMNOPQ",
    });
    const [event] = built.json.data as Record<string, unknown>[];
    expect(event).toMatchObject({
      event: "CompletePayment",
      event_id: base.eventId,
      user: { phone: sha256Hex(PHONE), ttclid: "E.C.P.abc", ttp: purchase.ttp },
      properties: { order_id: "MSR-0000042", content_type: "product" },
    });
    expect(built.body).not.toContain("server-token-1234");
  });

  it("مفتاح «إرسال الجوال المجزّأ» مطفأ: لا جوال، والبقية كما هي (القرار 90-3)", () => {
    const off = { sendHashedPhone: false } as const;
    const meta = request(
      buildPurchase("meta", { ...base, config: { pixelId: "1234567890", ...off } }),
    );
    const snap = request(
      buildPurchase("snap", {
        ...base,
        config: { pixelId: "0b1f7c2e-1234-4abc-9def-0123456789ab", ...off },
      }),
    );
    const tiktok = request(
      buildPurchase("tiktok", { ...base, config: { pixelId: "C1ABCDEFGHIJ", ...off } }),
    );
    for (const built of [meta, snap, tiktok]) {
      expect(built.body).not.toContain(sha256Hex("966512345678"));
      expect(built.body).not.toContain(sha256Hex(PHONE));
      expect(built.body).toContain(sha256Hex(purchase.customerId));
    }
  });

  it("الإعداد الناقص لا يُرسل", () => {
    for (const provider of ["ga4", "meta", "snap", "tiktok"] as const) {
      expect(buildPurchase(provider, { ...base, config: {} })).toEqual({
        kind: "skip",
        reason: "config_incomplete",
      });
    }
  });
});

describe("أحداث الاختبار", () => {
  const test = {
    secret: "t0ken-abcd",
    eventId: "test.1",
    siteUrl: "https://masar.test",
    now: new Date(),
  };

  it("ميتا وتيك توك تشترطان رمز الاختبار، وميتا بحدث مخصّص لا Purchase", () => {
    expect(
      buildTest("meta", { ...test, config: { pixelId: "123456789012345" }, testEventCode: null }),
    ).toEqual({
      kind: "skip",
      reason: "no_test_event_code",
    });
    const meta = request(
      buildTest("meta", {
        ...test,
        config: { pixelId: "123456789012345" },
        testEventCode: "TEST123",
      }),
    );
    expect(meta.json).toMatchObject({
      test_event_code: "TEST123",
      data: [{ event_name: "MasarTestEvent" }],
    });
    const tiktok = request(
      buildTest("tiktok", {
        ...test,
        config: { pixelId: "C1ABCDEFGHIJ2KLMNOPQ" },
        testEventCode: "TEST9",
      }),
    );
    expect(tiktok.json).toMatchObject({ test_event_code: "TEST9" });
  });

  it("GA4 وسناب إلى نقطتي التحقق", () => {
    const ga4 = request(
      buildTest("ga4", { ...test, config: { measurementId: "G-ABC1234" }, testEventCode: null }),
    );
    expect(ga4.url).toContain("https://www.google-analytics.com/debug/mp/collect?");
    const snap = request(
      buildTest("snap", {
        ...test,
        config: { pixelId: "0b1f7c2e-1234-4abc-9def-0123456789ab" },
        testEventCode: null,
      }),
    );
    expect(snap.url).toContain("/events/validate?");
  });
});

describe("قراءة الرد", () => {
  const response = (status: number, body: string) => ({ kind: "response", status, body }) as const;

  it("خطأ الجسم لكل منصة، والانقطاع كما هو", () => {
    expect(interpret("tiktok", response(200, '{"code":40100,"message":"x"}'))).toEqual({
      kind: "response",
      status: 200,
      apiError: "api_40100",
      apiRetryable: true,
    });
    expect(interpret("tiktok", response(200, '{"code":0}'))).toEqual({
      kind: "response",
      status: 200,
      apiError: null,
      apiRetryable: true,
    });
    expect(
      interpret("ga4", response(200, '{"validationMessages":[{"fieldPath":"x"}]}')),
    ).toMatchObject({
      apiError: "validation_failed",
    });
    expect(interpret("snap", response(200, '{"status":"INVALID"}'))).toMatchObject({
      apiError: "api_invalid",
      apiRetryable: false,
    });
    expect(interpret("meta", response(400, "{}"))).toEqual({
      kind: "response",
      status: 400,
      apiError: null,
      apiRetryable: false,
    });
    expect(interpret("meta", { kind: "network", reason: "timeout" })).toEqual({
      kind: "network",
      reason: "timeout",
    });
  });
});

describe("مهلة حجز المرسِل", () => {
  it("أطول من أسوأ زمن للدفعة (كل حدث بمهلة الناقل كاملة)", () => {
    for (const batch of [1, 20, 50]) {
      expect(leaseFor(batch)).toBeGreaterThan(batch * TRANSPORT_TIMEOUT_MS);
    }
  });
});
