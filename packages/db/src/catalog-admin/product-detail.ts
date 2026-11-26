/**
 * صفحة المنتج في اللوحة: الهوية، وسجل النسخ كاملًا (الأحدث أولًا) بعدد ما بيع من كل نسخة، والمزايا،
 * وروابط الإضافات، وعدد الطلبات المعلّقة الحيّة التي تحمل المنتج (تبقى بلقطتها حتى مهلتها).
 */
import {
  isSellable,
  money,
  type LocalizedText,
  type Money,
  type ProductKind,
  type ProductStatus,
} from "@masar/domain";
import type { Db } from "../client";
import { productLockToken } from "./locks";
import { tierOf } from "./read-products";

export interface CatalogVersionRow {
  readonly id: string;
  readonly price: Money;
  readonly durationMonths: number | null;
  readonly bonusMonths: number;
  readonly validFrom: Date;
  /** نهاية غير مشمولة؛ null = مفتوحة. */
  readonly validUntil: Date | null;
  readonly soldItems: number;
  readonly current: boolean;
  readonly benefits: readonly LocalizedText[];
}

export interface CatalogLinkRow {
  readonly id: string;
  readonly slug: string;
  readonly name: LocalizedText;
  readonly status: ProductStatus;
  readonly linked: boolean;
}

export interface CatalogProductDetail {
  readonly id: string;
  readonly slug: string;
  readonly kind: ProductKind;
  readonly name: LocalizedText;
  readonly summary: LocalizedText;
  readonly tier: LocalizedText | null;
  readonly sortOrder: number;
  readonly status: ProductStatus;
  readonly createdAt: Date;
  readonly versions: readonly CatalogVersionRow[];
  readonly currentVersion: CatalogVersionRow | null;
  readonly sellable: boolean;
  readonly soldItems: number;
  /**
   * للإضافة: كل اشتراكات النادي غير المؤرشفة ومعها هل هي مرتبطة. للاشتراك: الإضافات المرتبطة به فقط.
   * لغيرهما قائمة فارغة.
   */
  readonly links: readonly CatalogLinkRow[];
  /** طلبات معلّقة لم تبلغ مهلتها وفيها هذا المنتج. */
  readonly pendingOrders: number;
  /** رمز القفل المتفائل لنماذج التعديل. */
  readonly lockToken: string;
}

function isCurrent(version: { validFrom: Date; validUntil: Date | null }, now: Date): boolean {
  return (
    version.validFrom.getTime() <= now.getTime() &&
    (version.validUntil === null || version.validUntil.getTime() > now.getTime())
  );
}

function findProduct(db: Db, clubId: string, productId: string) {
  return db.product.findFirst({
    where: { id: productId, clubId },
    include: {
      versions: {
        orderBy: [{ validFrom: "desc" }, { id: "desc" }],
        include: {
          benefits: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
          _count: { select: { orderItemsByPrice: true } },
        },
      },
      offeredWith: { select: { membershipProductId: true } },
      addonsOffered: {
        orderBy: [{ sortOrder: "asc" }, { addon: { slug: "asc" } }],
        select: {
          addon: { select: { id: true, slug: true, nameAr: true, nameEn: true, status: true } },
        },
      },
      _count: { select: { orderItems: true } },
    },
  });
}

type ProductRecord = NonNullable<Awaited<ReturnType<typeof findProduct>>>;

async function linkRows(db: Db, clubId: string, row: ProductRecord): Promise<CatalogLinkRow[]> {
  if (row.kind === "membership") {
    return row.addonsOffered.map(({ addon }) => ({
      id: addon.id,
      slug: addon.slug,
      name: { ar: addon.nameAr, en: addon.nameEn },
      status: addon.status,
      linked: true,
    }));
  }
  if (row.kind !== "addon") {
    return [];
  }
  const linked = new Set(row.offeredWith.map((link) => link.membershipProductId));
  const plans = await db.product.findMany({
    where: {
      clubId,
      kind: "membership",
      OR: [{ status: { not: "archived" } }, { id: { in: [...linked] } }],
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, slug: true, nameAr: true, nameEn: true, status: true },
  });
  return plans.map((plan) => ({
    id: plan.id,
    slug: plan.slug,
    name: { ar: plan.nameAr, en: plan.nameEn },
    status: plan.status,
    linked: linked.has(plan.id),
  }));
}

function versionRows(row: ProductRecord, now: Date): CatalogVersionRow[] {
  return row.versions.map((version) => ({
    id: version.id,
    price: money(version.priceMinor, version.currency),
    durationMonths: version.durationMonths,
    bonusMonths: version.bonusMonths,
    validFrom: version.validFrom,
    validUntil: version.validUntil,
    soldItems: version._count.orderItemsByPrice,
    current: isCurrent(version, now),
    benefits: version.benefits.map((benefit) => ({ ar: benefit.labelAr, en: benefit.labelEn })),
  }));
}

/** منتج من نادي الموظف بمعرّفه، أو undefined (معرّف من نادٍ آخر لا يُرى). */
export async function getCatalogProduct(
  db: Db,
  clubId: string,
  productId: string,
  now: Date,
): Promise<CatalogProductDetail | undefined> {
  const row = await findProduct(db, clubId, productId);
  if (row === null) {
    return undefined;
  }
  const versions = versionRows(row, now);
  const currentVersion = versions.find((version) => version.current) ?? null;
  const pendingOrders = await db.order.count({
    where: { status: "pending_payment", expiresAt: { gt: now }, items: { some: { productId } } },
  });
  return {
    id: row.id,
    slug: row.slug,
    kind: row.kind,
    name: { ar: row.nameAr, en: row.nameEn },
    summary: { ar: row.summaryAr, en: row.summaryEn },
    tier: tierOf(row),
    sortOrder: row.sortOrder,
    status: row.status,
    createdAt: row.createdAt,
    versions,
    currentVersion,
    sellable: isSellable({ status: row.status, kind: row.kind, currentVersion }),
    soldItems: row._count.orderItems,
    links: await linkRows(db, clubId, row),
    pendingOrders,
    lockToken: productLockToken(row.updatedAt, currentVersion?.id ?? null),
  };
}
