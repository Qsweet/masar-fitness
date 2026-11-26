/** قراءة سجل التدقيق للوحة: تصفية بنوع الكيان ونوع الفاعل، وصفحات، الأحدث أولًا. */
import type { Db } from "../client";
import type { AuditActor, AuditEntityType } from "../commerce/audit";
import type { Prisma } from "../generated/prisma/client";
import { STAFF_AUDIT_ENTITY } from "./audit";

export const AUDIT_ENTITY_TYPES = [
  "order",
  "membership",
  "refund",
  "assessment_request",
  "payment_attempt",
  STAFF_AUDIT_ENTITY,
] as const satisfies readonly (AuditEntityType | typeof STAFF_AUDIT_ENTITY)[];
export type AuditEntityFilter = (typeof AUDIT_ENTITY_TYPES)[number];

export const AUDIT_ACTOR_KINDS = [
  "staff",
  "system",
  "customer",
  "provider",
] as const satisfies readonly AuditActor[];
export type AuditActorKind = (typeof AUDIT_ACTOR_KINDS)[number];

export interface AuditQuery {
  readonly clubId: string;
  readonly entityType?: AuditEntityFilter;
  readonly actorKind?: AuditActorKind;
  /** تبدأ من 1. */
  readonly page: number;
  readonly pageSize: number;
}

export interface AuditRow {
  readonly id: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly action: string;
  readonly fromState: string | null;
  readonly toState: string | null;
  readonly actor: string;
  readonly data: Readonly<Record<string, unknown>>;
  readonly createdAt: Date;
}

export interface AuditPage {
  readonly rows: readonly AuditRow[];
  readonly total: number;
}

function actorFilter(kind: AuditActorKind): Prisma.AuditLogWhereInput {
  // فاعل الموظف «staff» (البيع) أو «staff:<معرّف>» (اللوحة)
  return kind === "staff" ? { actor: { startsWith: "staff" } } : { actor: kind };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function listAuditLogs(db: Db, query: AuditQuery): Promise<AuditPage> {
  const where: Prisma.AuditLogWhereInput = {
    clubId: query.clubId,
    ...(query.entityType === undefined ? {} : { entityType: query.entityType }),
    ...(query.actorKind === undefined ? {} : actorFilter(query.actorKind)),
  };
  const [rows, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    db.auditLog.count({ where }),
  ]);
  return {
    rows: rows.map((row) => ({ ...row, data: isRecord(row.data) ? row.data : {} })),
    total,
  };
}
