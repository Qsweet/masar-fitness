import "server-only";

/** حد محاولات لكل مفتاح في نافذة زمنية ثابتة. */
export interface RateLimitRule {
  readonly limit: number;
  readonly windowMs: number;
}

export interface RateLimiter {
  /** يسجّل محاولة للمفتاح ويرجع true إن بقيت ضمن الحد؛ المحاولة المرفوضة لا تُعدّ. */
  consume(key: string, nowMs: number): boolean;
}

interface Window {
  count: number;
  readonly resetAtMs: number;
}

/**
 * ما يُفعل بمفتاح جديد والذاكرة ممتلئة بنوافذ حيّة:
 * - `evict` (الافتراضي، حدود الشراء): تُحذف أقدم نافذة، فالخدمة لا تتوقف والذاكرة لا تكبر.
 * - `refuse` (حدود دخول اللوحة): يُرفض المفتاح الجديد ولا تُحذف نافذة حيّة، فلا يمحو مهاجم عدّاد
 *   ضحيته بإغراق المحدِّد بمفاتيح مختلقة.
 */
export type WhenFull = "evict" | "refuse";

/** يحذف النوافذ المنتهية، ثم (مع `evict`) الأقدم إن بقيت الذاكرة ممتلئة (ترتيب الإدراج في Map). */
function makeRoom(
  windows: Map<string, Window>,
  maxKeys: number,
  nowMs: number,
  whenFull: WhenFull,
): void {
  for (const [key, window] of windows) {
    if (window.resetAtMs <= nowMs) {
      windows.delete(key);
    }
  }
  if (whenFull === "refuse") {
    return;
  }
  for (const key of windows.keys()) {
    if (windows.size < maxKeys) {
      return;
    }
    windows.delete(key);
  }
}

/**
 * محدِّد بنافذة ثابتة في ذاكرة العملية. الذاكرة محدودة بـ`maxKeys`: عند امتلائها تُحذف المنتهية ثم
 * الأقدم، فلا يكبر مع مفاتيح مختلقة. يصلح لعملية خادم واحدة (deploy/compose.yml)؛ التوسع إلى أكثر
 * من عملية يحتاج مخزنًا مشتركًا.
 */
export function createRateLimiter(
  rule: RateLimitRule,
  maxKeys: number,
  whenFull: WhenFull = "evict",
): RateLimiter {
  if (!Number.isInteger(rule.limit) || rule.limit < 1 || rule.windowMs <= 0 || maxKeys < 1) {
    throw new RangeError("rate_limit.invalid_rule");
  }
  const windows = new Map<string, Window>();
  return {
    consume(key, nowMs) {
      const current = windows.get(key);
      if (current !== undefined && current.resetAtMs > nowMs) {
        if (current.count >= rule.limit) {
          return false;
        }
        current.count += 1;
        return true;
      }
      windows.delete(key);
      if (windows.size >= maxKeys) {
        makeRoom(windows, maxKeys, nowMs, whenFull);
      }
      if (windows.size >= maxKeys) {
        return false;
      }
      windows.set(key, { count: 1, resetAtMs: nowMs + rule.windowMs });
      return true;
    },
  };
}
