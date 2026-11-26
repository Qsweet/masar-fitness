/**
 * النشر والإخفاء والأرشفة (ADMIN_A2_SALES §4.3). تغييرات حالة منتجات النادي تتسلسل بقفل استشاري، فعدّ
 * «الباقات القابلة للبيع الأخرى» لا يسبقه تغيير متزامن: إخفاء آخر باقة يحتاج تأكيدًا صريحًا. الطلبات
 * المعلّقة لا تُمس: تبقى قابلة للدفع بلقطتها حتى مهلتها.
 */
import {
  DomainError,
  decideProductStatus,
  err,
  isSellable,
  ok,
  publishBlockers,
  type ProductStatus,
  type ProductStatusAction,
  type Result,
} from "@masar/domain";
import type { Db } from "../client";
import type { StaffAuditActor } from "../commerce/audit";
import { inTransaction, type Tx } from "../commerce/transaction";
import { writeCatalogAudit, type CatalogAuditAction } from "./audit";
import { lockClubCatalogStatus, touchProduct } from "./locks";
import { countOtherSellableMemberships } from "./read-products";
import { mapCatalogAdminDbError } from "./sql-errors";
import { lockEditableProduct, type EditableProduct } from "./write-product";

export interface SetProductStatusInput {
  readonly productId: string;
  readonly clubId: string;
  readonly lockToken: string;
  readonly action: ProductStatusAction;
  /** تأكيد صريح أن بعد هذا الإجراء لا باقة تُباع. */
  readonly confirmLast: boolean;
  readonly actor: StaffAuditActor;
  readonly now: Date;
}

export interface ProductStatusResult {
  readonly status: ProductStatus;
  readonly replayed: boolean;
  /** كانت آخر باقة قابلة للبيع وأُخفيت بتأكيد. */
  readonly lastSellable: boolean;
}

const AUDIT_ACTION: Readonly<Record<ProductStatusAction, CatalogAuditAction>> = {
  publish: "product_published",
  unpublish: "product_unpublished",
  archive: "product_archived",
};

async function checkPublishable(
  tx: Tx,
  { product, version }: EditableProduct,
): Promise<Result<true, DomainError>> {
  const linkedPlans = await tx.productAddon.count({ where: { addonProductId: product.id } });
  const { blockers } = publishBlockers({
    kind: product.kind,
    name: { ar: product.name_ar, en: product.name_en },
    summary: { ar: product.summary_ar, en: product.summary_en },
    currentVersion: version === undefined ? null : { durationMonths: version.duration_months },
    linkedPlans,
  });
  const [first] = blockers;
  return first === undefined
    ? ok(true)
    : err(new DomainError("conflict", `catalog.publish_blocked.${first}`));
}

/** هل هذا المنتج آخر اشتراك يُباع في النادي الآن؟ يُعدّ تحت القفل الاستشاري. */
async function isLastSellable(
  tx: Tx,
  { product, version }: EditableProduct,
  input: SetProductStatusInput,
): Promise<boolean> {
  const sellableNow = isSellable({
    status: product.status,
    kind: product.kind,
    currentVersion: version === undefined ? null : { durationMonths: version.duration_months },
  });
  if (product.kind !== "membership" || !sellableNow) {
    return false;
  }
  return (await countOtherSellableMemberships(tx, input.clubId, product.id, input.now)) === 0;
}

async function setInTransaction(
  tx: Tx,
  input: SetProductStatusInput,
): Promise<Result<ProductStatusResult, DomainError>> {
  await lockClubCatalogStatus(tx, input.clubId);
  const locked = await lockEditableProduct(tx, input);
  if (!locked.ok) {
    return locked;
  }
  const { product } = locked.value;
  const decision = decideProductStatus(product.status, input.action);
  if (!decision.ok) {
    return decision;
  }
  const { to, replay } = decision.value;
  if (replay) {
    return ok({ status: to, replayed: true, lastSellable: false });
  }
  const publishable =
    input.action === "publish" ? await checkPublishable(tx, locked.value) : ok(true);
  if (!publishable.ok) {
    return publishable;
  }
  const lastSellable =
    input.action !== "publish" && (await isLastSellable(tx, locked.value, input));
  if (lastSellable && !input.confirmLast) {
    return err(new DomainError("conflict", "catalog.last_sellable_membership"));
  }
  await tx.$executeRaw`UPDATE products SET status = ${to}::product_status WHERE id = ${product.id}::uuid`;
  await touchProduct(tx, product, input.now);
  await writeCatalogAudit(tx, {
    product,
    action: AUDIT_ACTION[input.action],
    actor: input.actor,
    at: input.now,
    fromState: product.status,
    toState: to,
    data: { lastSellable },
  });
  return ok({ status: to, replayed: false, lastSellable });
}

export async function setProductStatus(
  db: Db,
  input: SetProductStatusInput,
): Promise<Result<ProductStatusResult, DomainError>> {
  try {
    return await inTransaction(db, (tx) => setInTransaction(tx, input));
  } catch (error) {
    const mapped = mapCatalogAdminDbError(error);
    if (mapped !== undefined) {
      return err(mapped);
    }
    throw error;
  }
}
