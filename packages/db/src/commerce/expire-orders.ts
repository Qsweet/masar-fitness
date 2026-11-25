/**
 * إنهاء الطلبات المعلّقة التي بلغت مهلتها. الصحة لا تعتمد على الجدولة: القراءة تستعمل
 * `effectiveOrderStatus`، والطلب الفائت غير المنتهي يبقى حاجزًا لعرضه حتى يُكتب منتهيًا.
 *
 * شرط صلب على المرحلة 4: يجب أن يستثني هذا الإنهاء كل طلب له محاولة دفع `pending` أو `authorized`
 * (جدول payment_attempts لم يوجد بعد)، وأن تنتهي جلسة المزوّد قبل `expires_at` بهامش.
 */
import { Prisma } from "../generated/prisma/client";
import type { Tx } from "./transaction";

/** حجم الدفعة الواحدة: يُقفل ويُكتب هذا العدد على الأكثر في جملة واحدة. */
export const EXPIRE_BATCH_SIZE = 500;

export interface ExpireOptions {
  readonly now: Date;
  readonly limit: number;
  /** يحصر الإنهاء في طلبات هذا العميل أو الطلبات الحاملة لهذه العروض (من `createOrder`). */
  readonly customerId?: string;
  readonly promotionIds?: readonly string[];
}

function scopeFilter(options: ExpireOptions): Prisma.Sql {
  const { customerId, promotionIds } = options;
  if (customerId === undefined && promotionIds === undefined) {
    return Prisma.empty;
  }
  return Prisma.sql`AND (o.customer_id = ${customerId ?? null}::uuid OR o.id IN (
    SELECT od.order_id FROM order_discounts od
    WHERE od.promotion_id = ANY(${[...(promotionIds ?? [])]}::uuid[])))`;
}

/**
 * جملة واحدة: يقفل المستحق بـSKIP LOCKED (فلا ينتظر طلبًا تُسجَّل دفعته الآن)، ويكتبه منتهيًا
 * بشرط `pending_payment`، ويلحق سطر تدقيق لكل طلب. يرجع عدد ما أُنهي.
 */
export async function expireDueOrders(client: Tx, options: ExpireOptions): Promise<number> {
  const { now, limit } = options;
  const rows = await client.$queryRaw<{ count: number }[]>`
    WITH due AS (
      SELECT o.id FROM orders o
      WHERE o.status = 'pending_payment' AND o.expires_at <= ${now} ${scopeFilter(options)}
      ORDER BY o.expires_at, o.id LIMIT ${limit}
      FOR UPDATE OF o SKIP LOCKED
    ), expired AS (
      UPDATE orders SET status = 'expired', expired_at = ${now}
      WHERE id IN (SELECT id FROM due) AND status = 'pending_payment'
      RETURNING id, club_id, reference
    ), audited AS (
      INSERT INTO audit_logs (id, club_id, entity_type, entity_id, action, from_state, to_state, actor,
        data, created_at)
      SELECT gen_random_uuid(), club_id, 'order', id, 'order_expired', 'pending_payment', 'expired',
        'system', jsonb_build_object('reference', reference), ${now}
      FROM expired
      RETURNING 1
    )
    SELECT (SELECT count(*) FROM expired)::int AS count`;
  return rows[0]?.count ?? 0;
}

/**
 * يكرر الإنهاء دفعةً بعد دفعة حتى ترجع دفعة أقل من حدّها، فلا يبقى مستحق غير مقفول في النطاق.
 * ينتهي دائمًا: كل دفعة تكتب صفوفها منتهية فلا تعود تطابق، والمقفول يُتخطى فلا يُعدّ.
 */
export async function expireAllDueOrders(client: Tx, options: ExpireOptions): Promise<number> {
  let total = 0;
  for (;;) {
    const expired = await expireDueOrders(client, options);
    total += expired;
    if (expired < options.limit) {
      return total;
    }
  }
}
