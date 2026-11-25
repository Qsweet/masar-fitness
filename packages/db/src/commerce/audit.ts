/** سطر التدقيق: إلحاق فقط (trigger)، وبلا جوال ولا اسم في `data`. */
import { DomainError } from "@masar/domain";
import type { Prisma } from "../generated/prisma/client";
import type { Tx } from "./transaction";

export type AuditEntityType = "order" | "membership" | "refund" | "assessment_request";
export type AuditActor = "system" | "customer" | "staff" | "provider";

/** قيم بسيطة فقط: لا كائنات متداخلة يختبئ فيها حقل شخصي. */
export type AuditValue = string | number | boolean | null;

export interface AuditEntry {
  readonly clubId: string;
  readonly entityType: AuditEntityType;
  readonly entityId: string;
  readonly action: string;
  readonly fromState: string | null;
  readonly toState: string | null;
  readonly actor: AuditActor;
  readonly data: Readonly<Record<string, AuditValue>>;
  readonly at: Date;
}

/**
 * مفاتيح لا تُكتب في التدقيق أبدًا. الفحص بالمفتاح لا بالقيمة: معرّف دفعة المزوّد قد يحوي أرقامًا
 * تشبه الجوال، والقيم كلها يكتبها الكود لا العميل.
 */
const PERSONAL_KEYS = /phone|mobile|name/i;

function assertNoPersonalData(data: AuditEntry["data"]): void {
  for (const key of Object.keys(data)) {
    if (PERSONAL_KEYS.test(key)) {
      throw new DomainError("invariant", "audit.personal_data");
    }
  }
}

export async function writeAudit(tx: Tx, entry: AuditEntry): Promise<void> {
  assertNoPersonalData(entry.data);
  const data: Prisma.InputJsonObject = { ...entry.data };
  await tx.auditLog.create({
    data: {
      clubId: entry.clubId,
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      fromState: entry.fromState,
      toState: entry.toState,
      actor: entry.actor,
      data,
      createdAt: entry.at,
    },
  });
}
