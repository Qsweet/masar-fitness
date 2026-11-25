/**
 * الأقفال الصريحة لطبقة البيع. الترتيب الثابت في `createOrder`: المفتاح ← العميل ← النسخ ← العروض
 * ← الطلبات الفائتة (SKIP LOCKED)، وفي `markOrderPaid`: الطلب ← العميل. أي ترتيب آخر يفتح باب التعانق.
 */
import { randomUUID } from "node:crypto";
import { DomainError } from "@masar/domain";
import type { Tx } from "./transaction";

/** يسلسل كل الطلبات بالمفتاح نفسه مهما اختلف الجوال؛ يتحرر عند نهاية المعاملة. */
export async function lockIdempotencyKey(tx: Tx, key: string): Promise<void> {
  // ‏`::text` لأن pg_advisory_xact_lock ترجع void، ومحوّل Prisma لا يقرأ عمود void
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}::text, 0))::text AS locked`;
}

/**
 * يضمن صف العميل بجواله ثم يقفله FOR UPDATE: نقطة التسلسل لكل طلبات الجوال نفسه.
 * يرجع معرّفه. الصف الجديد يتراجع مع المعاملة إن رُفضت العملية.
 */
export async function ensureCustomerLocked(tx: Tx, clubId: string, phone: string): Promise<string> {
  await tx.$executeRaw`
    INSERT INTO customers (id, club_id, phone_e164) VALUES (${randomUUID()}::uuid, ${clubId}::uuid, ${phone})
    ON CONFLICT (club_id, phone_e164) DO NOTHING`;
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id::text AS id FROM customers WHERE club_id = ${clubId}::uuid AND phone_e164 = ${phone}
    FOR UPDATE`;
  const id = rows[0]?.id;
  if (id === undefined) {
    throw new DomainError("invariant", "customer.not_locked");
  }
  return id;
}

/** يقفل صف عميل قائم (تسوية الدفع تسلسل فحص الاشتراك الحي عليه). */
export async function lockCustomer(tx: Tx, customerId: string): Promise<void> {
  await tx.$queryRaw`SELECT id::text AS id FROM customers WHERE id = ${customerId}::uuid FOR UPDATE`;
}

/** النسخ المباعة FOR SHARE بترتيب المعرّف: تعديل مزاياها (FOR UPDATE في trigger) ينتظر الطلب أو يسبقه. */
export async function lockVersionsForShare(tx: Tx, ids: readonly string[]): Promise<void> {
  await tx.$queryRaw`
    SELECT id::text AS id FROM product_versions WHERE id = ANY(${[...ids]}::uuid[]) ORDER BY id FOR SHARE`;
}

/** العروض المرشّحة FOR UPDATE بترتيب المعرّف: الطلبات على العرض نفسه تتسلسل فتعدّ الاستخدام بعد اعتماد ما قبلها. */
export async function lockPromotions(tx: Tx, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) {
    return;
  }
  await tx.$queryRaw`
    SELECT id::text AS id FROM promotions WHERE id = ANY(${[...ids]}::uuid[]) ORDER BY id FOR UPDATE`;
}
