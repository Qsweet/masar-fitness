import { createHash, timingSafeEqual } from "node:crypto";

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/**
 * مقارنة سرّين بزمن ثابت: `timingSafeEqual` على بصمتي sha256، فلا يكشف الزمن طول السر ولا أول
 * موضع اختلاف، ولا ترمي عند اختلاف الطول.
 */
export function secretsEqual(received: string, expected: string): boolean {
  return timingSafeEqual(digest(received), digest(expected));
}
