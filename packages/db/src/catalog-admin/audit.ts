/** أحداث الكتالوج في سجل التدقيق (`entity_type = product`). لا مفتاح يحوي `name`: الحقول تُسمّى `title_*`. */
import { writeAudit, type AuditValue, type StaffAuditActor } from "../commerce/audit";
import type { Tx } from "../commerce/transaction";
import type { LockedProduct } from "./locks";

export const CATALOG_AUDIT_ACTIONS = [
  "product_created",
  "product_updated",
  "product_version_created",
  "product_benefits_updated",
  "product_addon_links_updated",
  "product_published",
  "product_unpublished",
  "product_archived",
] as const;
export type CatalogAuditAction = (typeof CATALOG_AUDIT_ACTIONS)[number];

export interface CatalogAuditInput {
  readonly product: Pick<LockedProduct, "id" | "club_id" | "slug">;
  readonly action: CatalogAuditAction;
  readonly actor: StaffAuditActor;
  readonly at: Date;
  readonly data?: Readonly<Record<string, AuditValue>>;
  readonly fromState?: string;
  readonly toState?: string;
}

export async function writeCatalogAudit(tx: Tx, input: CatalogAuditInput): Promise<void> {
  await writeAudit(tx, {
    clubId: input.product.club_id,
    entityType: "product",
    entityId: input.product.id,
    action: input.action,
    fromState: input.fromState ?? null,
    toState: input.toState ?? null,
    actor: input.actor,
    data: { slug: input.product.slug, ...input.data },
    at: input.at,
  });
}
