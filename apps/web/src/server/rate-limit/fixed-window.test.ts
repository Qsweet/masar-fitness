import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./fixed-window";

const WINDOW_MS = 60_000;
const RULE = { limit: 3, windowMs: WINDOW_MS };
const MAX_KEYS = 100;

function attempts(count: number, consume: () => boolean): boolean[] {
  return Array.from({ length: count }, consume);
}

describe("محدِّد المحاولات بنافذة ثابتة", () => {
  it("يسمح بالحد ثم يرفض حتى تنتهي النافذة، والمرفوض لا يُعدّ", () => {
    const limiter = createRateLimiter(RULE, MAX_KEYS);
    expect(attempts(5, () => limiter.consume("ip", 0))).toEqual([true, true, true, false, false]);
    expect(limiter.consume("ip", WINDOW_MS - 1)).toBe(false);
    expect(attempts(4, () => limiter.consume("ip", WINDOW_MS))).toEqual([true, true, true, false]);
  });

  it("المفاتيح مستقلة", () => {
    const limiter = createRateLimiter(RULE, MAX_KEYS);
    attempts(RULE.limit, () => limiter.consume("a", 0));
    expect(limiter.consume("a", 0)).toBe(false);
    expect(limiter.consume("b", 0)).toBe(true);
  });

  it("الذاكرة محدودة: المفاتيح المختلقة تُخرج الأقدم ولا تمنع مفتاحًا جديدًا", () => {
    const small = 2;
    const limiter = createRateLimiter(RULE, small);
    attempts(RULE.limit, () => limiter.consume("old", 0));
    expect(limiter.consume("fresh1", 1)).toBe(true);
    expect(limiter.consume("fresh2", 2)).toBe(true);
    // «old» أُخرج لامتلاء الذاكرة، فيبدأ نافذة جديدة
    expect(limiter.consume("old", 3)).toBe(true);
  });

  it("النوافذ المنتهية تُحذف قبل الأقدم الحي", () => {
    const limiter = createRateLimiter(RULE, 2);
    limiter.consume("expired", 0);
    attempts(RULE.limit, () => limiter.consume("live", WINDOW_MS - 1));
    expect(limiter.consume("new", WINDOW_MS)).toBe(true);
    expect(limiter.consume("live", WINDOW_MS)).toBe(false);
  });

  it("قاعدة غير صالحة ترمي", () => {
    expect(() => createRateLimiter({ limit: 0, windowMs: WINDOW_MS }, MAX_KEYS)).toThrow(
      "rate_limit.invalid_rule",
    );
    expect(() => createRateLimiter({ limit: 1, windowMs: 0 }, MAX_KEYS)).toThrow(RangeError);
  });
});
