/**
 * إنهاء الطلبات المعلّقة التي بلغت مهلتها. الصحة لا تعتمد على الجدولة: القراءة تستعمل
 * `effectiveOrderStatus`، والطلب الفائت غير المنتهي يبقى حاجزًا لعرضه حتى يُكتب منتهيًا.
 *
 * الشرط الصلب 2 (المرحلة 4): لا يُنهى طلب له محاولة دفع حيّة. جملة واحدة فيها `NOT EXISTS` لا تكفي
 * في READ COMMITTED: بدء الدفع يقفل الطلب ويُدرج المحاولة ويعتمد، والقفل وحده لا يغيّر الصف، فلا
 * تعيد PostgreSQL تقييم الشرط بلقطة الجملة القديمة. لذلك جملتان داخل معاملة واحدة: الأولى تأخذ
 * الأقفال، والثانية (بلقطة جديدة) ترى كل محاولة اعتُمدت قبل أخذ القفل. والـtrigger
 * `orders_forbid_expiry_with_live_attempt` سدّ احتياطي يحوّل أي نسيان إلى خطأ ظاهر.
 */
import { Prisma } from "../generated/prisma/client";
import type { Db } from "../client";
import { ensureTransaction, type Tx } from "./transaction";

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

/** الطلب بلا محاولة دفع حيّة. يُكتب في الجملتين: الأولى كي لا يحجز المحميّ نافذة الدفعة، والثانية هي الحاسمة. */
const NO_LIVE_ATTEMPT = Prisma.sql`NOT EXISTS (
  SELECT 1 FROM payment_attempts a
  WHERE a.order_id = o.id AND payment_attempt_is_live(a.status, a.settled_at))`;

/** الجملة الأولى: تقفل المستحق بـSKIP LOCKED (فلا تنتظر طلبًا تُسجَّل دفعته أو تبدأ محاولته الآن). */
async function lockDueOrders(tx: Tx, options: ExpireOptions): Promise<string[]> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT o.id::text AS id FROM orders o
    WHERE o.status = 'pending_payment' AND o.expires_at <= ${options.now} AND ${NO_LIVE_ATTEMPT}
      ${scopeFilter(options)}
    ORDER BY o.expires_at, o.id LIMIT ${options.limit}
    FOR UPDATE OF o SKIP LOCKED`;
  return rows.map((row) => row.id);
}

/** الجملة الثانية بعد أخذ الأقفال: تكتب المقفول منتهيًا إن بقي معلّقًا وبلا محاولة حيّة، مع سطر تدقيقه. */
async function expireLockedOrders(tx: Tx, ids: readonly string[], now: Date): Promise<number> {
  const rows = await tx.$queryRaw<{ count: number }[]>`
    WITH expired AS (
      UPDATE orders o SET status = 'expired', expired_at = ${now}
      WHERE o.id = ANY(${[...ids]}::uuid[]) AND o.status = 'pending_payment' AND ${NO_LIVE_ATTEMPT}
      RETURNING o.id, o.club_id, o.reference
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
 * ينهي دفعة واحدة من المستحق ويرجع عدد ما أُنهي. يعمل داخل معاملة المستدعي إن وُجدت (`createOrder`)،
 * وإلا يفتح معاملته، فأقفال الجملة الأولى باقية حتى تنتهي الثانية في الحالتين.
 */
export function expireDueOrders(client: Db | Tx, options: ExpireOptions): Promise<number> {
  return ensureTransaction(client, async (tx) => {
    const ids = await lockDueOrders(tx, options);
    return ids.length === 0 ? 0 : expireLockedOrders(tx, ids, options.now);
  });
}

/**
 * يكرر الإنهاء دفعةً بعد دفعة حتى ترجع دفعة أقل من حدّها، فلا يبقى مستحق غير مقفول في النطاق.
 * ينتهي دائمًا: كل دفعة تكتب صفوفها منتهية فلا تعود تطابق، والمقفول وذو المحاولة الحيّة يُتخطيان فلا يُعدّان.
 */
export async function expireAllDueOrders(client: Db | Tx, options: ExpireOptions): Promise<number> {
  let total = 0;
  for (;;) {
    const expired = await expireDueOrders(client, options);
    total += expired;
    if (expired < options.limit) {
      return total;
    }
  }
}
