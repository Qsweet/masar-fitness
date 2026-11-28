import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrackCall } from "../types";
import { injectScript } from "./globals";
import { loadOpenai, withdrawOpenaiConsent } from "./openai";

vi.mock("./globals", () => ({ injectScript: vi.fn() }));

const purchase: TrackCall = {
  event: "purchase",
  payload: {
    eventId: "purchase.0193",
    value: 1499.5,
    valueMinor: 149_950,
    currency: "SAR",
    lines: [{ id: "six-months", name: "ستة أشهر", price: 1499.5, priceMinor: 149_950 }],
    sha256Phone: "a".repeat(64),
  },
};

let queue: unknown[][];

beforeEach(() => {
  queue = [];
  vi.stubGlobal("window", {
    oaiq: (...args: unknown[]) => {
      queue.push(args);
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OpenAI Measurement Pixel (القرار 93)", () => {
  it("بلا طابور الشيفرة الأساسية لا شيء، ومعه السكربت الرسمي مرة والموافقة قبل init", () => {
    vi.stubGlobal("window", {});
    expect(loadOpenai({ pixelId: "1345349876" }, "n0nce")).toBeNull();
    vi.stubGlobal("window", { oaiq: (...args: unknown[]) => queue.push(args) });
    loadOpenai({ pixelId: "1345349876" }, "n0nce");
    loadOpenai({ pixelId: "1345349876" }, "n0nce");
    expect(vi.mocked(injectScript).mock.calls).toEqual([
      ["https://bzrcdn.openai.com/sdk/oaiq.min.js", "n0nce"],
    ]);
    expect(queue.slice(0, 2)).toEqual([
      ["consent", true],
      ["init", { pixelId: "1345349876" }],
    ]);
  });

  it("الشراء order_created بالهللة وevent_id المشترك مع الخادم، بلا جوال من المتصفح", () => {
    loadOpenai({ pixelId: "1345349876" }, undefined)?.send(purchase);
    expect(queue[2]).toEqual([
      "measure",
      "order_created",
      {
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
      { event_id: "purchase.0193" },
    ]);
    expect(JSON.stringify(queue)).not.toContain("a".repeat(64));
  });

  it("الصفحة والسلة وبدء الشراء والاستفسار بأسمائها وأشكالها", () => {
    const sink = loadOpenai({ pixelId: "1345349876" }, undefined);
    sink?.send({ event: "page_view", payload: { eventId: "e1" } });
    sink?.send({ ...purchase, event: "add_to_cart" });
    sink?.send({ ...purchase, event: "begin_checkout" });
    sink?.send({ event: "generate_lead", payload: { eventId: "e4", interest: "pt" } });
    expect(queue.slice(2).map((item) => [item[1], (item[2] as { type: string }).type])).toEqual([
      ["page_viewed", "contents"],
      ["items_added", "contents"],
      ["checkout_started", "contents"],
      ["lead_created", "customer_action"],
    ]);
  });

  it("السكربت يستبدل oaiq ويفرّغ الطابور مرة: ما بعده يصل الدالة الجديدة لا الطابور الميت", () => {
    const sink = loadOpenai({ pixelId: "1345349876" }, undefined);
    const sdk: unknown[][] = [];
    window.oaiq = (...args: unknown[]) => {
      sdk.push(args);
    };
    sink?.send(purchase);
    expect(sdk.map((args) => args[1])).toEqual(["order_created"]);
    expect(queue).toHaveLength(2);
  });

  it("سحب الإعلانات: consent false (يمحو كوكيات البكسل)، والتحليلات وحدها لا تمسّه", () => {
    withdrawOpenaiConsent({ analytics: false, ads: true, version: 1, at: 1 });
    expect(queue).toEqual([]);
    withdrawOpenaiConsent({ analytics: true, ads: false, version: 1, at: 1 });
    expect(queue).toEqual([["consent", false]]);
  });
});
