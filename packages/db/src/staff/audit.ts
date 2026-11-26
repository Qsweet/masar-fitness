/**
 * تدقيق أحداث الموظفين في `audit_logs` القائم (ADMIN_DESIGN §4.10): الكيان `staff_user`، والفاعل
 * `staff:<معرّف>` أو `system`. لا كلمة مرور ولا رمز ولا سر ولا بريد ولا اسم في `data`.
 */
import { DomainError } from "@masar/domain";
import type { AuditValue, StaffAuditActor } from "../commerce/audit";
import type { Tx } from "../commerce/transaction";
import type { Prisma } from "../generated/prisma/client";

export const STAFF_AUDIT_ENTITY = "staff_user";

/** أحداث A1. الأسماء ثابتة: تُترجم في اللوحة ويطابقها الاختبار. */
export const STAFF_AUDIT_ACTIONS = [
  "login_succeeded",
  "login_failed",
  "account_locked",
  "logout",
  "mfa_verified",
  "mfa_failed",
  "mfa_enrolled",
  "mfa_reset",
  "recovery_code_used",
  "password_changed",
  "password_reset",
  "staff_created",
  "role_changed",
  "staff_disabled",
  "staff_enabled",
  "session_revoked",
] as const;
export type StaffAuditAction = (typeof STAFF_AUDIT_ACTIONS)[number];

export type StaffActor = "system" | StaffAuditActor;

export function staffActor(staffId: string): StaffAuditActor {
  return `staff:${staffId}`;
}

/** معرّف الكيان حين لا حساب يطابق البريد المكتوب: لا يُحفظ البريد نفسه (قد يكون كلمة مرور كُتبت خطأً). */
export const UNKNOWN_STAFF_ID = "00000000-0000-0000-0000-000000000000";

export interface StaffAuditEntry {
  readonly clubId: string;
  readonly staffId: string;
  readonly action: StaffAuditAction;
  readonly actor: StaffActor;
  readonly fromState?: string;
  readonly toState?: string;
  readonly data?: Readonly<Record<string, AuditValue>>;
  readonly at: Date;
}

/** الفحص بالمفتاح: كل القيم يكتبها الكود، والمفتاح الممنوع خلل برمجي يجب أن يظهر. */
const SECRET_KEYS = /password|secret|token|code|hash|email|name|phone|mobile/i;

export function assertNoSecrets(data: Readonly<Record<string, AuditValue>>): void {
  for (const key of Object.keys(data)) {
    if (SECRET_KEYS.test(key)) {
      throw new DomainError("invariant", "audit.secret_data");
    }
  }
}

export async function writeStaffAudit(tx: Tx, entry: StaffAuditEntry): Promise<void> {
  const data = entry.data ?? {};
  assertNoSecrets(data);
  const json: Prisma.InputJsonObject = { ...data };
  await tx.auditLog.create({
    data: {
      clubId: entry.clubId,
      entityType: STAFF_AUDIT_ENTITY,
      entityId: entry.staffId,
      action: entry.action,
      fromState: entry.fromState ?? null,
      toState: entry.toState ?? null,
      actor: entry.actor,
      data: json,
      createdAt: entry.at,
    },
  });
}
