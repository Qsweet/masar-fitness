import { describe, expect, it } from "vitest";
import { decideDelivery, isTooOld, MAX_DELIVERY_ATTEMPTS } from "./delivery";

const now = new Date("2026-11-27T10:00:00Z");
const response = (status: number, apiError: string | null = null) =>
  ({ kind: "response", status, apiError }) as const;

describe("قرار الإرسال", () => {
  it("2xx بلا خطأ في الجسم: أُرسل", () => {
    expect(decideDelivery(response(200), 1, now)).toEqual({ kind: "sent" });
    expect(decideDelivery(response(204), 1, now)).toEqual({ kind: "sent" });
  });

  it("خطأ واجهة دائم في جسم 200: يموت بسببه، والمؤقت (حد المعدل) يُعاد حتى أقصى المحاولات", () => {
    expect(decideDelivery(response(200, "api_invalid"), 1, now)).toEqual({
      kind: "dead",
      reason: "api_invalid",
    });
    const throttled = { ...response(200, "api_40100"), apiRetryable: true };
    expect(decideDelivery(throttled, 1, now)).toMatchObject({ kind: "retry", reason: "api_40100" });
    expect(decideDelivery(throttled, MAX_DELIVERY_ATTEMPTS, now)).toEqual({
      kind: "dead",
      reason: "api_40100",
    });
  });

  it("408 و429 و5xx والانقطاع: إعادة بتأخير متصاعد", () => {
    const at = (attempts: number) => {
      const decision = decideDelivery(response(503), attempts, now);
      return decision.kind === "retry" ? (decision.at.getTime() - now.getTime()) / 60_000 : null;
    };
    expect([1, 2, 3, 4, 5].map(at)).toEqual([1, 5, 30, 120, 720]);
    expect(decideDelivery(response(429), 1, now).kind).toBe("retry");
    expect(decideDelivery(response(408), 1, now).kind).toBe("retry");
    expect(decideDelivery({ kind: "network", reason: "timeout" }, 2, now)).toMatchObject({
      kind: "retry",
      reason: "timeout",
    });
  });

  it("4xx غيرها تموت فورًا، والمحاولة الأخيرة تموت", () => {
    expect(decideDelivery(response(400), 1, now)).toEqual({ kind: "dead", reason: "http_400" });
    expect(decideDelivery(response(401), 1, now)).toEqual({ kind: "dead", reason: "http_401" });
    expect(decideDelivery(response(500), MAX_DELIVERY_ATTEMPTS, now).kind).toBe("dead");
  });

  it("الحدث أقدم من حد المنصة", () => {
    const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000);
    expect(isTooOld("ga4", hoursAgo(73), now)).toBe(true);
    expect(isTooOld("ga4", hoursAgo(71), now)).toBe(false);
    expect(isTooOld("meta", hoursAgo(167), now)).toBe(false);
    expect(isTooOld("meta", hoursAgo(169), now)).toBe(true);
  });
});
