/**
 * قراءة العروض للوحة (ADMIN_A2_SALES §5). العدّادات كلها من `order_discounts` الحقيقي لا من عدّاد
 * مخزَّن: «الاستخدام النشط» بتعريف T4 و`loadUsage` نفسه (طلبه ليس `expired` ولا `cancelled`)، وعدد
 * الطلبات المدفوعة ومجموع الخصم الممنوح فيها.
 */
import {
  money,
  promotionDisplayState,
  type LocalizedText,
  type Money,
  type PromotionDisplayState,
  type PromotionRule,
} from "@masar/domain";
import type { Db } from "../client";
import { toPromotionRule } from "../commerce/load-promotions";

export interface PromotionUsage {
  /** كل صفوف الخصم لهذا العرض، بأي حالة طلب: وجود صف واحد يجمّد شروطه. */
  readonly total: number;
  readonly active: number;
  readonly paidOrders: number;
  /** مجموع الخصم الممنوح في الطلبات المدفوعة، بعملة النادي. */
  readonly discountGranted: Money;
}

export interface PromotionAdminRow {
  readonly rule: PromotionRule;
  /** منتجات النطاق بأسمائها (فارغة لنطاق كل المنتجات). */
  readonly products: readonly { readonly id: string; readonly name: LocalizedText }[];
  readonly usage: PromotionUsage;
  readonly state: PromotionDisplayState;
  readonly createdAt: Date;
  /** رمز القفل المتفائل لنموذج التعديل. */
  readonly lockToken: string;
}

interface UsageRow {
  promotion_id: string;
  total: number;
  active: number;
  paid: number;
  granted: string;
}

async function loadUsage(db: Db, ids: readonly string[]): Promise<Map<string, UsageRow>> {
  if (ids.length === 0) {
    return new Map();
  }
  // المجموع bigint يُقرأ نصًا: `money()` تتحقق أنه عدد صحيح آمن
  const rows = await db.$queryRaw<UsageRow[]>`
    SELECT od.promotion_id::text AS promotion_id, count(*)::int AS total,
      (count(*) FILTER (WHERE o.status NOT IN ('expired', 'cancelled')))::int AS active,
      (count(*) FILTER (WHERE o.paid_at IS NOT NULL))::int AS paid,
      coalesce(sum(od.amount_minor) FILTER (WHERE o.paid_at IS NOT NULL), 0)::text AS granted
    FROM order_discounts od JOIN orders o ON o.id = od.order_id
    WHERE od.promotion_id = ANY(${[...ids]}::uuid[])
    GROUP BY od.promotion_id`;
  return new Map(rows.map((row) => [row.promotion_id, row]));
}

export function promotionLockToken(updatedAt: Date): string {
  return String(updatedAt.getTime());
}

function findRows(db: Db, clubId: string, id?: string) {
  return db.promotion.findMany({
    where: { clubId, ...(id === undefined ? {} : { id }) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: {
      products: {
        orderBy: { productId: "asc" },
        select: { productId: true, product: { select: { nameAr: true, nameEn: true } } },
      },
    },
  });
}

async function toAdminRows(
  db: Db,
  clubId: string,
  rows: Awaited<ReturnType<typeof findRows>>,
  now: Date,
): Promise<PromotionAdminRow[]> {
  const club = await db.club.findUniqueOrThrow({
    where: { id: clubId },
    select: { currency: true },
  });
  const usage = await loadUsage(
    db,
    rows.map((row) => row.id),
  );
  return rows.map((row) => {
    const rule = toPromotionRule(row);
    const used = usage.get(row.id);
    const active = used?.active ?? 0;
    return {
      rule,
      products: row.products.map((link) => ({
        id: link.productId,
        name: { ar: link.product.nameAr, en: link.product.nameEn },
      })),
      usage: {
        total: used?.total ?? 0,
        active,
        paidOrders: used?.paid ?? 0,
        discountGranted: money(Number(used?.granted ?? "0"), club.currency),
      },
      state: promotionDisplayState({ ...rule, activeRedemptions: active }, now),
      createdAt: row.createdAt,
      lockToken: promotionLockToken(row.updatedAt),
    };
  });
}

/** كل عروض النادي وكوبوناته، الأحدث أولًا، بعدّاداتها وحالتها المعروضة. */
export async function listPromotionsWithUsage(
  db: Db,
  clubId: string,
  now: Date,
): Promise<PromotionAdminRow[]> {
  return toAdminRows(db, clubId, await findRows(db, clubId), now);
}

/** عرض من نادي الموظف بمعرّفه، أو undefined. */
export async function getPromotionDetail(
  db: Db,
  clubId: string,
  promotionId: string,
  now: Date,
): Promise<PromotionAdminRow | undefined> {
  const rows = await toAdminRows(db, clubId, await findRows(db, clubId, promotionId), now);
  return rows[0];
}

export interface PromotionProductOption {
  readonly id: string;
  readonly name: LocalizedText;
  readonly kind: string;
}

/** منتجات النادي غير المؤرشفة التي تُشترى (اشتراكات وإضافات وبرامج): خيارات نطاق العرض. */
export async function listPromotionProductOptions(
  db: Db,
  clubId: string,
): Promise<PromotionProductOption[]> {
  const rows = await db.product.findMany({
    where: { clubId, status: { not: "archived" }, kind: { not: "assessed_service" } },
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, nameAr: true, nameEn: true, kind: true },
  });
  return rows.map((row) => ({
    id: row.id,
    name: { ar: row.nameAr, en: row.nameEn },
    kind: row.kind,
  }));
}
