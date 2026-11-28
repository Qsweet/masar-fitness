import type { PurchaseContext } from "@masar/db";
import { decideDelivery } from "@masar/domain";
import { describe, expect, it } from "vitest";
import { sha256Hex } from "./hash";
import { buildPurchase, buildTest, interpret, type Built, type PurchaseInput } from "./payloads";

const purchase: PurchaseContext = {
  orderId: "0193a1b2-0000-7000-8000-000000000001",
  reference: "MSR-0000042",
  customerId: "0193a1b2-0000-7000-8000-0000000000aa",
  phoneE164: "+966512345678",
  locale: "ar",
  totalMinor: 149_950,
  currency: "SAR",
  paidAt: new Date("2026-11-20T09:00:00Z"),
  items: [{ slug: "six-months", nameAr: "ستة أشهر", nameEn: "Six months", totalMinor: 149_950 }],
  consentAnalytics: true,
  consentAds: true,
  firstTouch: { values: { oppref: "oppref_first" }, at: 1_763_000_000 },
  lastTouch: { values: { oppref: "oppref_abc", ttclid: "E.C.P.abc" }, at: 1_763_100_000 },
  gaClientId: null,
  fbp: null,
  fbc: null,
  scid: null,
  ttp: null,
  obref: "123e4567-e89b-42d3-a456-426614174000",
  clientIp: "203.0.113.9",
  userAgent: "Mozilla/5.0 Test",
  pageUrl: "https://masar.test/checkout/six-months",
  purgedAt: null,
};

const input: PurchaseInput = {
  purchase,
  eventId: `purchase.${purchase.orderId}`,
  config: { pixelId: "1345349876" },
  secret: "openai-capi-key-1234",
  siteUrl: "https://masar.test",
};

function request(built: Built) {
  if (built.kind !== "request") {
    throw new Error(`لم يُبنَ: ${built.reason}`);
  }
  return { ...built.request, json: JSON.parse(built.request.body) as Record<string, unknown> };
}

describe("OpenAI Conversions API (القرار 91)", () => {
  it("مثال OpenAI الرسمي للجوال: ‎14155552671‎ ← 758fbf68…", () => {
    expect(sha256Hex("14155552671")).toBe(
      "758fbf68945f21c416814c539ab578876c8d98fb69e6da692def92cd52417fe0",
    );
  });

  it("order_created بمعرّف الشراء، والمبلغ بالهللة، وoppref من آخر لمسة، والمفتاح في الترويسة", () => {
    const built = request(buildPurchase("openai", input));
    expect(built.url).toBe("https://bzr.openai.com/v1/events?pid=1345349876");
    expect(built.headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer openai-capi-key-1234",
    });
    expect(built.json).toEqual({
      validate_only: false,
      events: [
        {
          id: input.eventId,
          type: "order_created",
          timestamp_ms: purchase.paidAt.getTime(),
          oppref: "oppref_abc",
          source_url: purchase.pageUrl,
          action_source: "web",
          user: {
            obref: purchase.obref,
            phone_numbers_sha256: [sha256Hex("966512345678")],
            external_ids_sha256: [sha256Hex(purchase.customerId)],
            ip_address: "203.0.113.9",
            user_agent: "Mozilla/5.0 Test",
          },
          data: {
            type: "contents",
            amount: 149_950,
            currency: "SAR",
            contents: [
              {
                id: "six-months",
                name: "ستة أشهر",
                content_type: "product",
                quantity: 1,
                amount: 149_950,
                currency: "SAR",
              },
            ],
          },
        },
      ],
    });
    expect(built.url).not.toContain("openai-capi-key");
    expect(built.body).not.toContain("966512345678");
    expect(built.body).not.toContain("openai-capi-key");
  });

  it("الجوال المطفأ لا يُرسل، ولا oppref ولا obref بلا قيمة صالحة", () => {
    const built = request(
      buildPurchase("openai", {
        ...input,
        config: { pixelId: "1345349876", sendHashedPhone: false },
        purchase: { ...purchase, firstTouch: null, lastTouch: null, obref: "bad value" },
      }),
    );
    const [event] = built.json.events as Record<string, Record<string, unknown>>[];
    expect(event).not.toHaveProperty("oppref");
    expect(event?.user).not.toHaveProperty("phone_numbers_sha256");
    expect(event?.user).not.toHaveProperty("obref");
  });

  it("بلا بكسل لا يُبنى، والاختبار validate_only بلا بيانات عميل", () => {
    expect(buildPurchase("openai", { ...input, config: {} })).toEqual({
      kind: "skip",
      reason: "config_incomplete",
    });
    const now = new Date("2026-11-28T10:00:00Z");
    const built = request(
      buildTest("openai", {
        config: input.config,
        secret: input.secret,
        testEventCode: null,
        eventId: "test.1",
        siteUrl: input.siteUrl,
        now,
      }),
    );
    expect(built.json).toEqual({
      validate_only: true,
      events: [
        {
          id: "test.1",
          type: "page_viewed",
          timestamp_ms: now.getTime(),
          source_url: "https://masar.test",
          action_source: "web",
          data: { type: "contents" },
        },
      ],
    });
  });

  it("الرفض برمز HTTP: 400 يموت و429 يُعاد", () => {
    const decide = (status: number) =>
      decideDelivery(interpret("openai", { kind: "response", status, body: "{}" }), 1, new Date())
        .kind;
    expect(decide(200)).toBe("sent");
    expect(decide(400)).toBe("dead");
    expect(decide(401)).toBe("dead");
    expect(decide(429)).toBe("retry");
    expect(decide(503)).toBe("retry");
  });
});
