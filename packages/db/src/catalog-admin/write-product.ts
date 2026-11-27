/**
 * إنشاء منتج وتعديل هويته (ADMIN_A2_SALES §4.2). الهوية `UPDATE products` فقط: الطلبات السابقة لا
 * تتأثر لأن أسماءها مختومة في `order_items`. المعرّف النصي والنوع يُكتبان عند الإنشاء وحده (P1).
 */
import {
  DomainError,
  checkPublishedTexts,
  err,
  ok,
  type ProductDraft,
  type ProductIdentity,
  type Result,
} from "@masar/domain";
import type { Db } from "../client";
import type { StaffAuditActor } from "../commerce/audit";
import { inTransaction, type Tx } from "../commerce/transaction";
import { writeCatalogAudit } from "./audit";
import {
  lockCurrentVersion,
  lockProductInClub,
  productLockToken,
  touchProduct,
  type LockedProduct,
  type LockedVersion,
} from "./locks";
import { isCreateCollision, mapCatalogAdminDbError } from "./sql-errors";

export interface CreateProductInput {
  /** يولَّد عند رسم النموذج: الإرسال الثاني بالمعرّف نفسه إعادة لا منتج ثانٍ. */
  readonly productId: string;
  readonly clubId: string;
  readonly draft: ProductDraft;
  readonly actor: StaffAuditActor;
  readonly now: Date;
}

export interface CreatedProduct {
  readonly productId: string;
  readonly replayed: boolean;
}

async function insertProduct(tx: Tx, input: CreateProductInput): Promise<string> {
  const { draft, clubId, productId, now } = input;
  const club = await tx.club.findUniqueOrThrow({
    where: { id: clubId },
    select: { currency: true },
  });
  const { identity, terms } = draft;
  const product = await tx.product.create({
    data: {
      id: productId,
      clubId,
      kind: draft.kind,
      slug: draft.slug,
      status: "draft",
      nameAr: identity.name.ar,
      nameEn: identity.name.en,
      summaryAr: identity.summary.ar,
      summaryEn: identity.summary.en,
      tierAr: identity.tier?.ar ?? null,
      tierEn: identity.tier?.en ?? null,
      sortOrder: identity.sortOrder,
      createdAt: now,
      versions: {
        create: {
          priceMinor: terms.priceMinor,
          currency: club.currency,
          durationMonths: terms.durationMonths,
          bonusMonths: terms.bonusMonths,
          validFrom: now,
          benefits: {
            create: terms.benefits.map((benefit, sortOrder) => ({
              labelAr: benefit.ar,
              labelEn: benefit.en,
              sortOrder,
            })),
          },
        },
      },
    },
    select: { versions: { select: { id: true } } },
  });
  return product.versions[0]?.id ?? "";
}

async function createInTransaction(
  tx: Tx,
  input: CreateProductInput,
): Promise<Result<CreatedProduct, DomainError>> {
  const { draft, clubId, productId } = input;
  const versionId = await insertProduct(tx, input);
  await writeCatalogAudit(tx, {
    product: { id: productId, club_id: clubId, slug: draft.slug },
    action: "product_created",
    actor: input.actor,
    at: input.now,
    toState: "draft",
    data: {
      kind: draft.kind,
      versionId,
      priceMinor: draft.terms.priceMinor,
      durationMonths: draft.terms.durationMonths,
      bonusMonths: draft.terms.bonusMonths,
    },
  });
  return ok({ productId, replayed: false });
}

/** هل الاصطدام إعادة إرسال للنموذج نفسه (المعرّف والنادي والمعرّف النصي نفسها)؟ */
async function isReplay(db: Db, input: CreateProductInput): Promise<boolean> {
  const existing = await db.product.findUnique({
    where: { id: input.productId },
    select: { clubId: true, slug: true },
  });
  return existing?.clubId === input.clubId && existing.slug === input.draft.slug;
}

/** ينشئ منتجًا `draft` بنسخته الأولى ومزاياها في معاملة واحدة مع سطر تدقيقه. */
export async function createProduct(
  db: Db,
  input: CreateProductInput,
): Promise<Result<CreatedProduct, DomainError>> {
  try {
    return await inTransaction(db, (tx) => createInTransaction(tx, input));
  } catch (error) {
    if (isCreateCollision(error)) {
      if (await isReplay(db, input)) {
        return ok({ productId: input.productId, replayed: true });
      }
      return err(
        new DomainError("conflict", "catalog.slug_taken", { field: "slug", cause: error }),
      );
    }
    throw error;
  }
}

export interface UpdateIdentityInput {
  readonly productId: string;
  readonly clubId: string;
  /** رمز القفل المتفائل كما رُسم في النموذج. */
  readonly lockToken: string;
  readonly identity: ProductIdentity;
  readonly actor: StaffAuditActor;
  readonly now: Date;
}

export interface UpdatedIdentity {
  /** أسماء الحقول التي تغيّرت؛ فارغة = لا كتابة. */
  readonly changed: readonly string[];
}

function changedFields(product: LockedProduct, identity: ProductIdentity): string[] {
  const pairs: readonly (readonly [string, string | number | null, string | number | null])[] = [
    ["title_ar", product.name_ar, identity.name.ar],
    ["title_en", product.name_en, identity.name.en],
    ["summary_ar", product.summary_ar, identity.summary.ar],
    ["summary_en", product.summary_en, identity.summary.en],
    ["tier_ar", product.tier_ar, identity.tier?.ar ?? null],
    ["tier_en", product.tier_en, identity.tier?.en ?? null],
    ["sort_order", product.sort_order, identity.sortOrder],
  ];
  return pairs.filter(([, before, after]) => before !== after).map(([field]) => field);
}

export interface EditableProduct {
  readonly product: LockedProduct;
  /** النسخة السارية الآن مقفولة، أو undefined. */
  readonly version: LockedVersion | undefined;
}

/**
 * المنتج ثم نسخته السارية مقفولين (الترتيب الثابت)، بعد فحص النوع ورمز القفل المتفائل. مشترك بين كل
 * كتابات الكتالوج.
 */
export async function lockEditableProduct(
  tx: Tx,
  input: { productId: string; clubId: string; lockToken: string; now: Date },
): Promise<Result<EditableProduct, DomainError>> {
  const product = await lockProductInClub(tx, input.productId, input.clubId);
  if (product === undefined) {
    return err(new DomainError("not_found", "catalog.product_not_found"));
  }
  if (product.kind !== "membership" && product.kind !== "addon") {
    return err(new DomainError("conflict", "catalog.kind_read_only"));
  }
  const version = await lockCurrentVersion(tx, product.id, input.now);
  if (productLockToken(product.updated_at, version?.id ?? null) !== input.lockToken) {
    return err(new DomainError("conflict", "catalog.stale_edit"));
  }
  return ok({ product, version });
}

async function updateInTransaction(
  tx: Tx,
  input: UpdateIdentityInput,
): Promise<Result<UpdatedIdentity, DomainError>> {
  const locked = await lockEditableProduct(tx, input);
  if (!locked.ok) {
    return locked;
  }
  const { product } = locked.value;
  const { identity } = input;
  // الحالة تحت قفل الصف: نشر متزامن لا يسبق الفحص
  const texts = checkPublishedTexts(product.status, identity);
  if (!texts.ok) {
    return texts;
  }
  // اسم الفئة للاشتراك وحده: الإضافة تحفظه فارغًا مهما أُرسل
  const tier = product.kind === "membership" ? identity.tier : null;
  const changed = changedFields(product, { ...identity, tier });
  if (changed.length === 0) {
    return ok({ changed });
  }
  await tx.$executeRaw`
    UPDATE products SET name_ar = ${identity.name.ar}, name_en = ${identity.name.en},
      summary_ar = ${identity.summary.ar}, summary_en = ${identity.summary.en},
      tier_ar = ${tier?.ar ?? null}, tier_en = ${tier?.en ?? null}, sort_order = ${identity.sortOrder}
    WHERE id = ${product.id}::uuid`;
  await touchProduct(tx, product, input.now);
  await writeCatalogAudit(tx, {
    product,
    action: "product_updated",
    actor: input.actor,
    at: input.now,
    data: { changed: changed.join(",") },
  });
  return ok({ changed });
}

/** يعدّل الاسمين والملخصين واسم الفئة والترتيب. رمز قفل قديم ⇒ `catalog.stale_edit` بلا دمج صامت. */
export async function updateProductIdentity(
  db: Db,
  input: UpdateIdentityInput,
): Promise<Result<UpdatedIdentity, DomainError>> {
  try {
    return await inTransaction(db, (tx) => updateInTransaction(tx, input));
  } catch (error) {
    const mapped = mapCatalogAdminDbError(error);
    if (mapped !== undefined) {
      return err(mapped);
    }
    throw error;
  }
}
