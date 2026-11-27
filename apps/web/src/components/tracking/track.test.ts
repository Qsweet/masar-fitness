import { afterEach, describe, expect, it, vi } from "vitest";
import type { TrackCall } from "./types";

/** الناقل في المتصفح: يكفيه `window.location.pathname`. كل اختبار بوحدة جديدة (حالة نظيفة). */
async function freshBus(path: string) {
  vi.resetModules();
  vi.stubGlobal("window", { location: { pathname: path } });
  return import("./track");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ناقل الأحداث", () => {
  it("بلا وجهة لا يخرج شيء، والوجهة بعد الموافقة تأخذ أحداث الصفحة الحالية وحدها", async () => {
    const bus = await freshBus("/memberships");
    bus.track("view_item", { eventId: "a" });
    (window as unknown as { location: { pathname: string } }).location.pathname = "/cart";
    bus.track("add_to_cart", { eventId: "b" });
    const received: TrackCall[] = [];
    bus.addSink({ send: (call) => received.push(call) });
    expect(received.map((call) => call.payload.eventId)).toEqual(["b"]);
    bus.track("begin_checkout", { eventId: "c" });
    expect(received.map((call) => call.payload.eventId)).toEqual(["b", "c"]);
    expect(bus.hasSinks()).toBe(true);
  });
});
