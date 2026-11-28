import type { IntegrationConfig } from "@masar/domain";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrackCall, TrackPayload } from "../types";
import { loadGtag } from "./google";
import { loadTiktok } from "./tiktok";
import { loadX } from "./x";

vi.mock("./globals", () => ({ injectScript: vi.fn() }));

const PHONE = "a".repeat(64);
const withoutClick: TrackPayload = {
  eventId: "purchase.0193",
  value: 1499.5,
  currency: "SAR",
  lines: [{ id: "six-months", name: "ستة أشهر", price: 1499.5, priceMinor: 149_950 }],
  sha256Phone: PHONE,
};
const purchase: TrackPayload = { ...withoutClick, twclid: "26ab3x9kq0" };
const call = (event: TrackCall["event"], payload: TrackPayload = purchase): TrackCall => ({
  event,
  payload,
});
const consent = { analytics: true, ads: true, version: 1, at: 1 };

beforeEach(() => {
  vi.stubGlobal("window", {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const X: IntegrationConfig = {
  pixelId: "o8z5x",
  purchaseEventId: "tw-o8z5x-p1q2r",
  leadEventId: "tw-o8z5x-l3m4n",
};

function xQueue(config: IntegrationConfig, calls: readonly TrackCall[]): unknown[] {
  const sink = loadX(config, undefined);
  for (const item of calls) {
    sink?.send(item);
  }
  return window.twq?.queue ?? [];
}

describe("X Pixel", () => {
  it("المزايا الآلية تُطفأ قبل config، والشراء بمعرّفه وconversion_id والجوال وtwclid", () => {
    const queue = xQueue(X, [call("purchase")]);
    expect(queue.slice(0, 5)).toEqual([
      ["set", "autoConfig", "false", "o8z5x"],
      ["set", "autoAdvancedMatching", "false", "o8z5x"],
      ["set", "dataLayerTracking", "false", "o8z5x"],
      ["set", "autoDwellTracking", "false", "o8z5x"],
      ["config", "o8z5x"],
    ]);
    expect(queue[5]).toEqual([
      "event",
      "tw-o8z5x-p1q2r",
      {
        value: 1499.5,
        currency: "SAR",
        conversion_id: "purchase.0193",
        contents: [
          {
            content_id: "six-months",
            content_name: "ستة أشهر",
            content_price: 1499.5,
            num_items: 1,
          },
        ],
        phone_number: PHONE,
        twclid: "26ab3x9kq0",
      },
    ]);
  });

  it("الاستفسار باسمه وحده، والحدث الذي لم يُضبط معرّفه لا يُرسل", () => {
    const queue = xQueue(X, [
      call("generate_lead", { eventId: "e1", interest: "boxing" }),
      call("add_to_cart"),
      call("view_item"),
      call("begin_checkout"),
    ]);
    expect(queue.slice(5)).toEqual([["event", "tw-o8z5x-l3m4n", {}]]);
  });

  it("الجوال المطفأ لا يُرسل، وبلا twclid لا مفتاح له", () => {
    const queue = xQueue({ ...X, sendHashedPhone: false }, [call("purchase", withoutClick)]);
    const data = (queue[5] as unknown[])[2] as Record<string, unknown>;
    expect(data).not.toHaveProperty("phone_number");
    expect(data).not.toHaveProperty("twclid");
  });

  it("أول page_view محسوب بـconfig التحميل، وما بعده config جديد", () => {
    const queue = xQueue(X, [call("page_view"), call("page_view"), call("page_view")]);
    expect(queue.slice(4)).toEqual([
      ["config", "o8z5x"],
      ["config", "o8z5x"],
      ["config", "o8z5x"],
    ]);
  });
});

describe("X قائم قبلنا (داخل GTM)", () => {
  it("أوامرنا تُطبَّق عليه، وتنبيه المطوّر في وحدة التحكم وحده", () => {
    const queue: unknown[] = [];
    const existing = Object.assign((...args: unknown[]) => queue.push(args), {
      queue,
      version: "1.1",
    });
    vi.stubGlobal("window", { twq: existing });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    loadX(X, undefined);
    expect(queue[0]).toEqual(["set", "autoConfig", "false", "o8z5x"]);
    expect(queue).toContainEqual(["config", "o8z5x"]);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe("مفتاح الجوال في المتصفح (القرار 90-3)", () => {
  const ads = { conversionId: "AW-123456", conversionLabel: "AbCd12" };

  function gtagCalls(config: IntegrationConfig): unknown[][] {
    const gtag = vi.fn();
    vi.stubGlobal("window", { gtag });
    loadGtag({ ga4: null, ads: config }, consent, undefined)?.send(call("purchase"));
    return gtag.mock.calls;
  }

  it("Google Ads: user_data مع المفتاح المفعَّل وحده", () => {
    const userData = ["set", "user_data", { sha256_phone_number: PHONE }];
    expect(gtagCalls(ads)).toContainEqual(userData);
    expect(gtagCalls({ ...ads, sendHashedPhone: false })).not.toContainEqual(userData);
  });

  it("TikTok: identify مع المفتاح المفعَّل وحده", () => {
    const identify = ["identify", { sha256_phone_number: PHONE }];
    const pixel = { pixelId: "C1ABCDEFGHIJ2KLMNOPQ" };
    loadTiktok(pixel, undefined)?.send(call("purchase"));
    expect([...(window.ttq ?? [])]).toContainEqual(identify);
    vi.stubGlobal("window", {});
    loadTiktok({ ...pixel, sendHashedPhone: false }, undefined)?.send(call("purchase"));
    expect([...(window.ttq ?? [])]).not.toContainEqual(identify);
  });
});
