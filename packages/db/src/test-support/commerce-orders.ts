/** مساعدات اختبارات طبقة البيع: مدخلات `createOrder` ومشترٍ صالح وعملاء قاعدة منفصلون للتزامن. */
import { randomBytes, randomUUID } from "node:crypto";
import { parseBuyer, type Buyer, type CouponCode, parseCouponCode } from "@masar/domain";
import { createDb, type Db } from "../client";
import type { CreateOrderInput } from "../commerce";
import { TEST_NOW, TEST_PHONE } from "./commerce-constants";

const TOKEN_BYTES = 32;
const PHONE_SUFFIX_DIGITS = 8;
/** الحد التقني للطلبات المعلّقة في الاختبارات (قيمة اختبار). */
export const TEST_MAX_PENDING = 3;

export function testDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (url === undefined || url === "") {
    throw new Error(
      "اختبارات التكامل تحتاج DATABASE_URL لقاعدة اختبار مُرحَّلة (انظر docs/TESTING.md)",
    );
  }
  return url;
}

export function testBuyer(mobile = TEST_PHONE, name = "عميل اختبار"): Buyer {
  const parsed = parseBuyer({ name, mobile });
  if (!parsed.ok) {
    throw new Error(`مشترٍ اختبار غير صالح: ${mobile}`);
  }
  return parsed.value;
}

/** جوال اختبار مختلف لكل رقم. */
export function testPhone(index: number): string {
  return `+9665${String(index).padStart(PHONE_SUFFIX_DIGITS, "0")}`;
}

export function couponCode(input: string): CouponCode {
  const parsed = parseCouponCode(input);
  if (!parsed.ok || parsed.value === null) {
    throw new Error(`رمز كوبون اختبار غير صالح: ${input}`);
  }
  return parsed.value;
}

export function newPublicToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/** مدخل طلب كامل بقيم صالحة، يُغيَّر منه ما يلزم الاختبار. */
export function orderInput(
  planSlug: string,
  quotedTotalMinor: number,
  overrides: Partial<CreateOrderInput> = {},
): CreateOrderInput {
  return {
    planSlug,
    addonSlugs: [],
    couponCode: null,
    buyer: testBuyer(),
    locale: "ar",
    idempotencyKey: randomUUID(),
    publicToken: newPublicToken(),
    quotedTotalMinor,
    maxPendingOrders: TEST_MAX_PENDING,
    now: TEST_NOW,
    ...overrides,
  };
}

/** عملاء قاعدة منفصلون (لكل منهم مجمَّع اتصالات) لاختبارات التزامن. */
export function createDbClients(count: number): Db[] {
  const url = testDatabaseUrl();
  return Array.from({ length: count }, () => createDb(url));
}

export async function disconnectAll(clients: readonly Db[]): Promise<void> {
  await Promise.all(clients.map((client) => client.$disconnect()));
}

/** يتوقع نتيجة ناجحة ويرجع قيمتها، أو يرمي بسبب الخطأ ليظهر في فشل الاختبار. */
export function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: Error }): T {
  if (!result.ok) {
    throw result.error;
  }
  return result.value;
}

/** يتوقع خطأ ويرجعه. */
export function failure<E>(result: { ok: true } | { ok: false; error: E }): E {
  if (result.ok) {
    throw new Error("توقعنا خطأ عمل، فنجحت العملية");
  }
  return result.error;
}
