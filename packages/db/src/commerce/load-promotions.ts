/**
 * العروض المرشّحة واستخدامها النشط. الاستخدام «نشط» ما دام طلبه ليس expired ولا cancelled،
 * فالطلب المعلّق الفائتة مهلته يبقى حاجزًا لعرضه حتى يُكتب منتهيًا (الاتجاه الآمن).
 */
import {
  DomainError,
  basisPoints,
  money,
  parseCouponCode,
  type CouponCode,
  type CouponFact,
  type PromotionCandidate,
  type PromotionDiscount,
  type PromotionRule,
} from "@masar/domain";
import type { Tx } from "./transaction";

export interface CandidateIds {
  readonly automaticIds: readonly string[];
  /** الكوبون بالرمز أيًّا كانت حالته، لتُرجَع أسباب رفضه للعميل؛ null إن لم يوجد. */
  readonly couponId: string | null;
}

export interface PromotionFacts {
  readonly automatic: readonly PromotionCandidate[];
  readonly coupon: CouponFact;
}

/** التلقائية الفعّالة السارية الآن المتقاطعة مع منتجات السلة، والكوبون بالرمز. */
export async function loadCandidateIds(
  client: Tx,
  clubId: string,
  productIds: readonly string[],
  code: CouponCode | null,
  now: Date,
): Promise<CandidateIds> {
  const automatic = await client.$queryRaw<{ id: string }[]>`
    SELECT p.id::text AS id FROM promotions p
    WHERE p.club_id = ${clubId}::uuid AND p.code IS NULL AND p.status = 'active'
      AND p.starts_at <= ${now} AND (p.ends_at IS NULL OR p.ends_at > ${now})
      AND (p.scope = 'all_products' OR EXISTS (
        SELECT 1 FROM promotion_products pp
        WHERE pp.promotion_id = p.id AND pp.product_id = ANY(${[...productIds]}::uuid[])))
    ORDER BY p.id`;
  const coupon =
    code === null
      ? undefined
      : await client.promotion.findUnique({
          where: { clubId_code: { clubId, code } },
          select: { id: true },
        });
  return { automaticIds: automatic.map((row) => row.id), couponId: coupon?.id ?? null };
}

/** كل المعرّفات مرتبة بلا تكرار: ترتيب القفل. */
export function candidateIdList(ids: CandidateIds): string[] {
  const all = ids.couponId === null ? ids.automaticIds : [...ids.automaticIds, ids.couponId];
  return [...new Set(all)].sort();
}

export type PromotionRow = Awaited<ReturnType<typeof findPromotions>>[number];

function findPromotions(client: Tx, ids: readonly string[]) {
  return client.promotion.findMany({
    where: { id: { in: [...ids] } },
    include: { products: { select: { productId: true }, orderBy: { productId: "asc" } } },
    orderBy: { id: "asc" },
  });
}

function invalidRow(reason: string): DomainError {
  return new DomainError("invariant", reason);
}

/** قاعدة الخصم من الصف؛ القيود تضمن اكتمالها، فالنقص عطل بيانات. */
function toDiscount(row: PromotionRow): PromotionDiscount {
  if (row.discountKind === "percentage") {
    if (row.percentBps === null) {
      throw invalidRow("promotion.percent_missing");
    }
    return { kind: "percentage", rate: basisPoints(row.percentBps) };
  }
  if (row.amountMinor === null || row.currency === null) {
    throw invalidRow("promotion.amount_missing");
  }
  return { kind: "fixed_amount", amount: money(row.amountMinor, row.currency) };
}

function toCode(code: string | null): CouponCode | null {
  if (code === null) {
    return null;
  }
  const parsed = parseCouponCode(code);
  if (!parsed.ok || parsed.value !== code) {
    throw invalidRow("promotion.code_malformed");
  }
  return parsed.value;
}

/** صف العرض وروابط منتجاته ← قاعدة المجال. تستعمله قراءة اللوحة أيضًا: تعريف واحد للعرض. */
export function toPromotionRule(row: PromotionRow): PromotionRule {
  return {
    id: row.id,
    code: toCode(row.code),
    name: { ar: row.nameAr, en: row.nameEn },
    status: row.status,
    discount: toDiscount(row),
    audience: row.audience,
    scope:
      row.scope === "all_products"
        ? { kind: "all_products" }
        : { kind: "listed_products", productIds: row.products.map((link) => link.productId) },
    stackable: row.stackable,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    maxRedemptions: row.maxRedemptions,
    maxRedemptionsPerCustomer: row.maxRedemptionsPerCustomer,
  };
}

interface UsageRow {
  promotion_id: string;
  total: number;
  by_customer: number;
}

/** الاستخدام النشط لكل عرض إجمالًا ولهذا العميل (صفر للعميل غير المعروف). */
async function loadUsage(
  client: Tx,
  ids: readonly string[],
  customerId: string | null,
): Promise<Map<string, PromotionCandidate["usage"]>> {
  const rows = await client.$queryRaw<UsageRow[]>`
    SELECT od.promotion_id::text AS promotion_id, count(*)::int AS total,
      (count(*) FILTER (WHERE od.customer_id = ${customerId}::uuid))::int AS by_customer
    FROM order_discounts od JOIN orders o ON o.id = od.order_id
    WHERE od.promotion_id = ANY(${[...ids]}::uuid[]) AND o.status NOT IN ('expired', 'cancelled')
    GROUP BY od.promotion_id`;
  return new Map(
    rows.map((row) => [row.promotion_id, { total: row.total, byCustomer: row.by_customer }]),
  );
}

/** القاعدة والاستخدام لكل معرّف. تُستدعى بعد قفل العروض في الإنشاء. */
export async function loadPromotionCandidates(
  client: Tx,
  ids: readonly string[],
  customerId: string | null,
): Promise<Map<string, PromotionCandidate>> {
  if (ids.length === 0) {
    return new Map();
  }
  const rows = await findPromotions(client, ids);
  const usage = await loadUsage(client, ids, customerId);
  return new Map(
    rows.map((row) => [
      row.id,
      { rule: toPromotionRule(row), usage: usage.get(row.id) ?? { total: 0, byCustomer: 0 } },
    ]),
  );
}

/** حقائق العروض كما تأخذها دالة المجال: التلقائية، والكوبون (لا رمز، أو رمز مجهول، أو مرشّح). */
export function toPromotionFacts(
  ids: CandidateIds,
  code: CouponCode | null,
  candidates: ReadonlyMap<string, PromotionCandidate>,
): PromotionFacts {
  const automatic = ids.automaticIds.flatMap((id) => {
    const candidate = candidates.get(id);
    return candidate === undefined ? [] : [candidate];
  });
  const found = ids.couponId === null ? undefined : candidates.get(ids.couponId);
  if (code === null) {
    return { automatic, coupon: { kind: "none" } };
  }
  return {
    automatic,
    coupon:
      found === undefined ? { kind: "unknown_code", code } : { kind: "found", candidate: found },
  };
}
