/**
 * أقفال إدارة الكتالوج. الترتيب الثابت في كل كتابة: صف المنتج `FOR UPDATE` أولًا ثم نسخته السارية
 * (ADMIN_A2_SALES §4.2). `createOrder` يأخذ `FOR SHARE` على النسخ، فتغيير نسخة ينتظر الطلب أو يسبقه.
 */
import type { ProductKind, ProductStatus } from "../generated/prisma/client";
import type { Tx } from "../commerce/transaction";

export interface LockedProduct {
  readonly id: string;
  readonly club_id: string;
  readonly kind: ProductKind;
  readonly slug: string;
  readonly status: ProductStatus;
  readonly name_ar: string;
  readonly name_en: string;
  readonly summary_ar: string;
  readonly summary_en: string;
  readonly tier_ar: string | null;
  readonly tier_en: string | null;
  readonly sort_order: number;
  readonly updated_at: Date;
}

/** يقفل المنتج داخل نادي الموظف؛ معرّف من نادٍ آخر لا يُقفل ولا يُرى. */
export async function lockProductInClub(
  tx: Tx,
  productId: string,
  clubId: string,
): Promise<LockedProduct | undefined> {
  const rows = await tx.$queryRaw<LockedProduct[]>`
    SELECT id::text AS id, club_id::text AS club_id, kind, slug, status, name_ar, name_en,
      summary_ar, summary_en, tier_ar, tier_en, sort_order, updated_at
    FROM products WHERE id = ${productId}::uuid AND club_id = ${clubId}::uuid FOR UPDATE`;
  return rows[0];
}

export interface LockedVersion {
  readonly id: string;
  readonly price_minor: number;
  readonly currency: string;
  readonly duration_months: number | null;
  readonly bonus_months: number;
  readonly valid_from: Date;
}

/** النسخة السارية الآن مقفولة `FOR UPDATE`: طلب يختم هذه النسخة ينتظر، أو يسبق فنراه مباعًا. */
export async function lockCurrentVersion(
  tx: Tx,
  productId: string,
  now: Date,
): Promise<LockedVersion | undefined> {
  const rows = await tx.$queryRaw<LockedVersion[]>`
    SELECT id::text AS id, price_minor, currency, duration_months, bonus_months, valid_from
    FROM product_versions
    WHERE product_id = ${productId}::uuid AND valid_from <= ${now}
      AND (valid_until IS NULL OR valid_until > ${now})
    ORDER BY valid_from DESC, id DESC LIMIT 1 FOR UPDATE`;
  return rows[0];
}

/**
 * رمز القفل المتفائل لنموذج تعديل المنتج: وقت آخر كتابة ومعرّف النسخة السارية. يُقارن تحت قفل الصف،
 * والاختلاف يعني أن موظفًا آخر عدّل المنتج بعد رسم النموذج.
 */
export function productLockToken(updatedAt: Date, currentVersionId: string | null): string {
  return `${String(updatedAt.getTime())}:${currentVersionId ?? "none"}`;
}

/**
 * يكتب وقت آخر تعديل صراحةً (`@updatedAt` يعمل مع عميل Prisma وحده). لا يساوي السابق أبدًا: كتابتان في
 * المللي ثانية نفسها تنتجان رمزين مختلفين.
 */
export async function touchProduct(tx: Tx, product: LockedProduct, now: Date): Promise<void> {
  const next = new Date(Math.max(now.getTime(), product.updated_at.getTime() + 1));
  await tx.$executeRaw`UPDATE products SET updated_at = ${next} WHERE id = ${product.id}::uuid`;
}

/** يسلسل تغييرات حالة منتجات النادي: عدّ «الباقات القابلة للبيع الأخرى» لا يسبقه تغيير متزامن. */
export async function lockClubCatalogStatus(tx: Tx, clubId: string): Promise<void> {
  const key = `catalog-status:${clubId}`;
  // ‏`::text` لأن pg_advisory_xact_lock ترجع void، ومحوّل Prisma لا يقرأ عمود void
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}::text, 0))::text AS locked`;
}
