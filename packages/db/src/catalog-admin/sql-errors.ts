/**
 * أسماء القيود والمحفّزات التي هي سدود أخيرة لسباقات إدارة الكتالوج ⇒ سبب خطأ العمل المقابل، فلا يصل
 * نص SQL إلى الواجهة. ما عداها (ومنه P1 وT5a: كتابة الكود نفسه لهوية أو شروط ثابتة) يبقى عطلًا يظهر.
 */
import { DomainError } from "@masar/domain";
import { constraintName } from "../commerce/sql-errors";

export const CATALOG_ADMIN_CONSTRAINTS = {
  slugUnique: "products_slug_key",
  productPrimaryKey: "products_pkey",
  versionOverlap: "product_versions_no_overlap",
  benefitsFrozen: "product_version_benefits_frozen",
} as const;

const REASONS: ReadonlyMap<string, string> = new Map([
  [CATALOG_ADMIN_CONSTRAINTS.slugUnique, "catalog.slug_taken"],
  // نسخة مجدولة أو كتابة متزامنة: لا نسختان ساريتان في اللحظة نفسها
  [CATALOG_ADMIN_CONSTRAINTS.versionOverlap, "catalog.version_overlap"],
  // طلب ختم النسخة بين القرار والكتابة (لا يحدث تحت قفل النسخة؛ سدّ T5b)
  [CATALOG_ADMIN_CONSTRAINTS.benefitsFrozen, "catalog.stale_edit"],
]);

export function mapCatalogAdminDbError(error: unknown): DomainError | undefined {
  const name = constraintName(error);
  const reason = name === undefined ? undefined : REASONS.get(name);
  if (reason === undefined) {
    return undefined;
  }
  const field = name === CATALOG_ADMIN_CONSTRAINTS.slugUnique ? { field: "slug" } : {};
  return new DomainError("conflict", reason, { cause: error, ...field });
}

/** هل الخطأ اصطدام إنشاء (المعرّف نفسه أو المعرّف النصي نفسه)؟ يُفحص بعده هل هو إعادة إرسال. */
export function isCreateCollision(error: unknown): boolean {
  const name = constraintName(error);
  return (
    name === CATALOG_ADMIN_CONSTRAINTS.productPrimaryKey ||
    name === CATALOG_ADMIN_CONSTRAINTS.slugUnique
  );
}
