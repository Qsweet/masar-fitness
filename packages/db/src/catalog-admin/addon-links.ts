/**
 * روابط إضافة بالباقات (`product_addons`): بلا صف ربط لا تُعرض الإضافة مع الباقة ولا تُقبل في سلتها.
 * تُستبدل روابط إضافة واحدة تحت قفل صفها؛ الروابط الباقية تحتفظ بترتيبها.
 */
import { DomainError, err, ok, type Result } from "@masar/domain";
import type { Db } from "../client";
import type { StaffAuditActor } from "../commerce/audit";
import { inTransaction, type Tx } from "../commerce/transaction";
import { writeCatalogAudit } from "./audit";
import { touchProduct } from "./locks";
import { mapCatalogAdminDbError } from "./sql-errors";
import { lockEditableProduct } from "./write-product";

export interface SetAddonLinksInput {
  /** الإضافة التي تُضبط روابطها. */
  readonly productId: string;
  readonly clubId: string;
  readonly lockToken: string;
  /** الباقات التي تُعرض معها الإضافة بعد الحفظ (القائمة كاملة). */
  readonly membershipIds: readonly string[];
  readonly actor: StaffAuditActor;
  readonly now: Date;
}

export interface AddonLinksResult {
  readonly linked: number;
  readonly added: number;
  readonly removed: number;
}

/** كل معرّف مطلوب اشتراك من النادي نفسه؛ وإلا فالطلب مصنوع لا من النموذج. */
async function allMembershipsOfClub(tx: Tx, clubId: string, ids: readonly string[]) {
  const found = await tx.product.count({
    where: { id: { in: [...ids] }, clubId, kind: "membership" },
  });
  return found === ids.length;
}

async function setInTransaction(
  tx: Tx,
  input: SetAddonLinksInput,
): Promise<Result<AddonLinksResult, DomainError>> {
  const locked = await lockEditableProduct(tx, input);
  if (!locked.ok) {
    return locked;
  }
  const { product } = locked.value;
  const wanted = [...new Set(input.membershipIds)];
  if (product.kind !== "addon" || !(await allMembershipsOfClub(tx, input.clubId, wanted))) {
    return err(new DomainError("validation", "catalog.addon_links_invalid"));
  }
  const existing = await tx.productAddon.findMany({
    where: { addonProductId: product.id },
    select: { membershipProductId: true },
  });
  const current = new Set(existing.map((link) => link.membershipProductId));
  const added = wanted.filter((id) => !current.has(id));
  const removed = [...current].filter((id) => !wanted.includes(id));
  const result = { linked: wanted.length, added: added.length, removed: removed.length };
  if (added.length === 0 && removed.length === 0) {
    return ok(result);
  }
  await tx.productAddon.deleteMany({
    where: { addonProductId: product.id, membershipProductId: { in: removed } },
  });
  await tx.productAddon.createMany({
    data: added.map((membershipProductId) => ({ membershipProductId, addonProductId: product.id })),
  });
  await touchProduct(tx, product, input.now);
  await writeCatalogAudit(tx, {
    product,
    action: "product_addon_links_updated",
    actor: input.actor,
    at: input.now,
    data: result,
  });
  return ok(result);
}

export async function setAddonLinks(
  db: Db,
  input: SetAddonLinksInput,
): Promise<Result<AddonLinksResult, DomainError>> {
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
