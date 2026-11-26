/**
 * تغيير شروط منتج (ADMIN_A2_SALES §4.2): السعر أو المدة أو الأشهر المجانية ⇒ نسخة جديدة دائمًا (تُغلق
 * السارية عند `now` وتُدرج التالية من `now`، بلا `UPDATE` لشروط نسخة أبدًا). المزايا وحدها ⇒ في مكانها
 * إن لم تُبع النسخة، وإلا نسخة جديدة بالشروط نفسها. القرار تحت قفل النسخة `FOR UPDATE`.
 */
import {
  DomainError,
  err,
  ok,
  planVersionChange,
  type LocalizedText,
  type ProductTerms,
  type Result,
  type VersionChange,
} from "@masar/domain";
import type { Db } from "../client";
import type { StaffAuditActor } from "../commerce/audit";
import { loadBenefits } from "../commerce/load-catalog";
import { inTransaction, type Tx } from "../commerce/transaction";
import { writeCatalogAudit } from "./audit";
import { touchProduct, type LockedProduct, type LockedVersion } from "./locks";
import { mapCatalogAdminDbError } from "./sql-errors";
import { lockEditableProduct } from "./write-product";

export interface ChangeVersionInput {
  readonly productId: string;
  readonly clubId: string;
  readonly lockToken: string;
  readonly terms: ProductTerms;
  /**
   * هل يملك الموظف `catalog.publish`؟ تغيير شروط منتج منشور يسري فورًا على ما يراه العميل ويدفعه،
   * فيُرفض بلاها. يُفحص هنا تحت قفل الصف، فلا يسبقه نشر متزامن.
   */
  readonly canChangePublished: boolean;
  readonly actor: StaffAuditActor;
  readonly now: Date;
}

export interface ChangedVersion {
  /** ما كُتب فعلًا: لا شيء، أو مزايا في مكانها، أو نسخة جديدة. */
  readonly written: "none" | "benefits" | "version";
  readonly versionId: string | null;
}

function benefitRows(versionId: string, benefits: readonly LocalizedText[]) {
  return benefits.map((benefit, sortOrder) => ({
    versionId,
    labelAr: benefit.ar,
    labelEn: benefit.en,
    sortOrder,
  }));
}

async function isSold(tx: Tx, versionId: string): Promise<boolean> {
  const rows = await tx.$queryRaw<{ sold: boolean }[]>`
    SELECT EXISTS (SELECT 1 FROM order_items WHERE product_version_id = ${versionId}::uuid) AS sold`;
  return rows[0]?.sold === true;
}

async function currentTerms(
  tx: Tx,
  version: LockedVersion | undefined,
): Promise<ProductTerms | null> {
  if (version === undefined) {
    return null;
  }
  const benefits = await loadBenefits(tx, [version.id]);
  return {
    priceMinor: version.price_minor,
    durationMonths: version.duration_months,
    bonusMonths: version.bonus_months,
    benefits: benefits.get(version.id) ?? [],
  };
}

interface Writing {
  readonly tx: Tx;
  readonly product: LockedProduct;
  readonly version: LockedVersion | undefined;
  readonly input: ChangeVersionInput;
}

async function replaceBenefits({ tx, product, version, input }: Writing, versionId: string) {
  await tx.productBenefit.deleteMany({ where: { versionId } });
  await tx.productBenefit.createMany({ data: benefitRows(versionId, input.terms.benefits) });
  await writeCatalogAudit(tx, {
    product,
    action: "product_benefits_updated",
    actor: input.actor,
    at: input.now,
    data: { versionId: version?.id ?? versionId, benefits: input.terms.benefits.length },
  });
}

function changedTerms(
  version: LockedVersion | undefined,
  terms: ProductTerms,
  change: VersionChange,
) {
  const changed = [
    version?.price_minor === terms.priceMinor ? null : "price",
    version?.duration_months === terms.durationMonths ? null : "duration",
    version?.bonus_months === terms.bonusMonths ? null : "bonus",
    change === "benefits_only" ? "benefits" : null,
  ];
  return changed.filter((field) => field !== null).join(",");
}

async function openNewVersion(
  writing: Writing,
  change: VersionChange,
): Promise<Result<string, DomainError>> {
  const { tx, product, version, input } = writing;
  const { terms, now } = input;
  if (version !== undefined) {
    // نسخة بدأت في هذه اللحظة أو بعدها لا تُغلق بمدى فارغ: كتابة متزامنة سبقت
    if (version.valid_from.getTime() >= now.getTime()) {
      return err(new DomainError("conflict", "catalog.stale_edit"));
    }
    await tx.$executeRaw`
      UPDATE product_versions SET valid_until = ${now} WHERE id = ${version.id}::uuid`;
  }
  const club = await tx.club.findUniqueOrThrow({
    where: { id: product.club_id },
    select: { currency: true },
  });
  const created = await tx.productVersion.create({
    data: {
      productId: product.id,
      priceMinor: terms.priceMinor,
      currency: club.currency,
      durationMonths: terms.durationMonths,
      bonusMonths: terms.bonusMonths,
      validFrom: now,
    },
    select: { id: true },
  });
  await tx.productBenefit.createMany({ data: benefitRows(created.id, terms.benefits) });
  await writeCatalogAudit(tx, {
    product,
    action: "product_version_created",
    actor: input.actor,
    at: now,
    data: {
      versionId: created.id,
      previousVersionId: version?.id ?? null,
      priceMinor: terms.priceMinor,
      previousPriceMinor: version?.price_minor ?? null,
      durationMonths: terms.durationMonths,
      bonusMonths: terms.bonusMonths,
      changed: changedTerms(version, terms, change),
    },
  });
  return ok(created.id);
}

async function applyChange(
  writing: Writing,
  change: VersionChange,
): Promise<Result<ChangedVersion, DomainError>> {
  const { tx, version } = writing;
  if (change === "benefits_only" && version !== undefined && !(await isSold(tx, version.id))) {
    await replaceBenefits(writing, version.id);
    return ok({ written: "benefits", versionId: version.id });
  }
  const opened = await openNewVersion(writing, change);
  return opened.ok ? ok({ written: "version", versionId: opened.value }) : opened;
}

async function changeInTransaction(
  tx: Tx,
  input: ChangeVersionInput,
): Promise<Result<ChangedVersion, DomainError>> {
  const locked = await lockEditableProduct(tx, input);
  if (!locked.ok) {
    return locked;
  }
  const { product, version } = locked.value;
  const change = planVersionChange(await currentTerms(tx, version), input.terms);
  if (change === "none") {
    return ok({ written: "none", versionId: version?.id ?? null });
  }
  if (product.status === "active" && !input.canChangePublished) {
    return err(new DomainError("forbidden", "catalog.publish_required"));
  }
  const applied = await applyChange({ tx, product, version, input }, change);
  if (applied.ok) {
    await touchProduct(tx, product, input.now);
  }
  return applied;
}

/**
 * يطبّق شروط النموذج على المنتج. الطلبات السابقة لا تتأثر: لقطتها مختومة ونسختها لا تُمس. رمز قفل
 * قديم ⇒ `catalog.stale_edit`.
 */
export async function changeProductVersion(
  db: Db,
  input: ChangeVersionInput,
): Promise<Result<ChangedVersion, DomainError>> {
  try {
    // كل رفض يسبق أول كتابة، فلا كتابة جزئية تُعتمد مع نتيجة رفض
    return await inTransaction(db, (tx) => changeInTransaction(tx, input));
  } catch (error) {
    const mapped = mapCatalogAdminDbError(error);
    if (mapped !== undefined) {
      return err(mapped);
    }
    throw error;
  }
}
