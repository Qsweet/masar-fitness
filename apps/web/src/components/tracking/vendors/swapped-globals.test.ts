import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Sink, TrackCall } from "../types";
import type { MetaStub, SnapStub, TiktokStub, XStub } from "./globals";
import { loadMeta } from "./meta";
import { loadSnap } from "./snap";
import { loadTiktok } from "./tiktok";
import { loadX } from "./x";

vi.mock("./globals", () => ({ injectScript: vi.fn() }));

/**
 * سكربت المنصة قد يستبدل الدالة العامة بعد تحميله (مراجعة القرار 93، H1): كل وجهة تقرأ الدالة من
 * `window` عند كل حدث، فلا يذهب حدث بعد التحميل إلى طابور لم يعد يُقرأ.
 */
const lead: TrackCall = { event: "generate_lead", payload: { eventId: "e1" } };

beforeEach(() => {
  vi.stubGlobal("window", {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function recorder(): { calls: unknown[][]; fn: (...args: unknown[]) => void } {
  const calls: unknown[][] = [];
  return {
    calls,
    fn: (...args: unknown[]) => {
      calls.push(args);
    },
  };
}

describe("الدالة العامة تُقرأ عند كل حدث", () => {
  it("Meta وSnap وX", () => {
    const cases: readonly (readonly [
      () => Sink | null,
      (fn: (...a: unknown[]) => void) => void,
    ])[] = [
      [
        () => loadMeta({ pixelId: "123456789012345" }, undefined),
        (fn) => {
          window.fbq = fn as MetaStub;
        },
      ],
      [
        () => loadSnap({ pixelId: "0b1f7c2e-1234-4abc-9def-0123456789ab" }, undefined),
        (fn) => {
          window.snaptr = fn as SnapStub;
        },
      ],
      [
        () => loadX({ pixelId: "o8z5x", leadEventId: "tw-o8z5x-l3m4n" }, undefined),
        (fn) => {
          window.twq = fn as XStub;
        },
      ],
    ];
    for (const [load, swap] of cases) {
      vi.stubGlobal("window", {});
      const sink = load();
      const real = recorder();
      swap(real.fn);
      sink?.send(lead);
      expect(real.calls).toHaveLength(1);
    }
  });

  it("TikTok", () => {
    const sink = loadTiktok({ pixelId: "C1ABCDEFGHIJ2KLMNOPQ" }, undefined);
    const real = recorder();
    window.ttq = { track: real.fn, page: real.fn, identify: real.fn } as unknown as TiktokStub;
    sink?.send(lead);
    expect(real.calls[0]?.[0]).toBe("Contact");
  });
});
