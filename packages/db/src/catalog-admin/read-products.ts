/**
 * قراءة الكتالوج للوحة (ADMIN_A2_SALES §4.1): كل الحالات لا المنشور وحده، مع النسخة السارية وعدد النسخ
 * وعدد سطور الطلبات المباعة، و«قابل للبيع الآن» بقاعدة المجال الواحدة `isSellable`.
 */
import {
  isSellable,
  money,
  PRODUCT_KINDS,
  type LocalizedText,
  type Money,
  type ProductKind,
  type ProductStatus,
} from "@masar/domain";
import type { Db } from "../client";
import { versionsAt } from "../commerce/load-catalog";

export interface CatalogVersionTerms {
  readonly id: string;
  readonly price: Money;
  readonly durationMonths: number | null;
  readonly bonusMonths: number;
}

export interface CatalogProductRow {
  readonly id: string;
  readonly slug: string;
  readonly kind: ProductKind;
  readonly name: LocalizedText;
  readonly tier: LocalizedText | null;
  readonly sortOrder: number;
  readonly status: ProductStatus;
  /** النسخة السارية الآن، أو null. */
  readonly currentVersion: CatalogVersionTerms | null;
  readonly versionCount: number;
  /** سطور الطلبات التي ختمت هذا المنتج، بكل حالات طلباتها. */
  readonly soldItems: number;
  readonly sellable: boolean;
}

export function tierOf(row: {
  tierAr: string | null;
  tierEn: string | null;
}): LocalizedText | null {
  return row.tierAr === null || row.tierEn === null ? null : { ar: row.tierAr, en: row.tierEn };
}

/** منتجات النادي من نوع واحد، بترتيب العرض. */
export async function listCatalogProducts(
  db: Db,
  clubId: string,
  kind: ProductKind,
  now: Date,
): Promise<CatalogProductRow[]> {
  const rows = await db.product.findMany({
    where: { clubId, kind },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    include: {
      versions: versionsAt(now),
      _count: { select: { versions: true, orderItems: true } },
    },
  });
  return rows.map((row) => {
    const version = row.versions[0] ?? null;
    return {
      id: row.id,
      slug: row.slug,
      kind: row.kind,
      name: { ar: row.nameAr, en: row.nameEn },
      tier: tierOf(row),
      sortOrder: row.sortOrder,
      status: row.status,
      currentVersion:
        version === null
          ? null
          : {
              id: version.id,
              price: money(version.priceMinor, version.currency),
              durationMonths: version.durationMonths,
              bonusMonths: version.bonusMonths,
            },
      versionCount: row._count.versions,
      soldItems: row._count.orderItems,
      sellable: isSellable({ status: row.status, kind: row.kind, currentVersion: version }),
    };
  });
}

/** عدد منتجات النادي لكل نوع: التبويبات تعرض ما له منتجات فقط من الأنواع التي لا تُنشأ من اللوحة. */
export async function countCatalogProducts(
  db: Db,
  clubId: string,
): Promise<Readonly<Record<ProductKind, number>>> {
  const groups = await db.product.groupBy({ by: ["kind"], where: { clubId }, _count: true });
  const count = (kind: ProductKind): number =>
    groups.find((group) => group.kind === kind)?._count ?? 0;
  return Object.fromEntries(PRODUCT_KINDS.map((kind) => [kind, count(kind)])) as Record<
    ProductKind,
    number
  >;
}

/** الاشتراكات القابلة للبيع الآن في النادي: بند «نشر الاشتراكات» في قائمة الإطلاق. */
export async function countSellableMemberships(
  db: Pick<Db, "product">,
  clubId: string,
  now: Date,
): Promise<number> {
  const rows = await db.product.findMany({
    where: { clubId, kind: "membership", status: "active" },
    select: { status: true, kind: true, versions: versionsAt(now) },
  });
  return rows.filter((row) =>
    isSellable({ status: row.status, kind: row.kind, currentVersion: row.versions[0] ?? null }),
  ).length;
}

/**
 * الاشتراكات القابلة للبيع الآن في النادي عدا منتجًا واحدًا: حارس «آخر باقة» وصفحة تأكيده. تُستدعى في
 * الكتابة تحت القفل الاستشاري للنادي.
 */
export async function countOtherSellableMemberships(
  db: Pick<Db, "product">,
  clubId: string,
  exceptProductId: string,
  now: Date,
): Promise<number> {
  const rows = await db.product.findMany({
    where: { clubId, kind: "membership", status: "active", id: { not: exceptProductId } },
    select: { status: true, kind: true, versions: versionsAt(now) },
  });
  return rows.filter((row) =>
    isSellable({ status: row.status, kind: row.kind, currentVersion: row.versions[0] ?? null }),
  ).length;
}
