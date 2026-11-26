/**
 * إدارة حسابات الموظفين: الإنشاء، وتغيير الدور والحالة، وكلمة المرور. كل تغيير يمسّ الدخول يلغي
 * جلسات صاحبه ويُسجَّل في التدقيق داخل المعاملة نفسها.
 */
import {
  assertOwnerRemains,
  DomainError,
  err,
  ok,
  type Result,
  type StaffRole,
  type StaffStanding,
} from "@masar/domain";
import type { Db } from "../client";
import { constraintName, isUniqueViolation } from "../commerce/sql-errors";
import { abort, inTransaction, type Tx } from "../commerce/transaction";
import {
  countActiveOwners,
  lockClubOwners,
  lockStaff,
  toAccount,
  type StaffAccount,
} from "./accounts";
import { writeStaffAudit, type StaffActor, type StaffAuditAction } from "./audit";
import { revokeAllStaffSessions } from "./sessions";

export const STAFF_CONSTRAINTS = {
  emailUnique: "staff_users_email_key",
  lastOwner: "staff_last_owner_required",
} as const;

export interface NewStaff {
  readonly clubId: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: StaffRole;
  readonly passwordHash: string;
  /** كلمة مؤقتة يغيّرها صاحبها عند أول دخول. */
  readonly mustChangePassword: boolean;
  readonly actor: StaffActor;
  readonly at: Date;
}

async function insertStaff(tx: Tx, input: NewStaff): Promise<StaffAccount> {
  const row = await tx.staffUser.create({
    data: {
      clubId: input.clubId,
      email: input.email,
      displayName: input.displayName,
      role: input.role,
      passwordHash: input.passwordHash,
      mustChangePassword: input.mustChangePassword,
      createdAt: input.at,
    },
  });
  await writeStaffAudit(tx, {
    clubId: input.clubId,
    staffId: row.id,
    action: "staff_created",
    actor: input.actor,
    toState: input.role,
    at: input.at,
  });
  return toAccount(row);
}

function emailTaken(): DomainError {
  return new DomainError("conflict", "staff.email_taken", { field: "email" });
}

async function mappingEmailConflict<T>(
  work: () => Promise<Result<T, DomainError>>,
): Promise<Result<T, DomainError>> {
  try {
    return await work();
  } catch (error) {
    if (isUniqueViolation(error, STAFF_CONSTRAINTS.emailUnique)) {
      return err(emailTaken());
    }
    throw error;
  }
}

export function createStaff(db: Db, input: NewStaff): Promise<Result<StaffAccount, DomainError>> {
  return mappingEmailConflict(() =>
    inTransaction(db, async (tx) => ok(await insertStaff(tx, input))),
  );
}

export type FirstOwner = Omit<NewStaff, "role" | "mustChangePassword" | "actor">;

/**
 * أول مالك (أمر الخادم `admin:create-owner`). يرفض إن وُجد مالك نشط في النادي؛ القفل الاستشاري
 * يمنع تشغيلين متزامنين من إنشاء مالكَين.
 */
export function createFirstOwner(
  db: Db,
  input: FirstOwner,
): Promise<Result<StaffAccount, DomainError>> {
  return mappingEmailConflict(() =>
    inTransaction(db, async (tx) => {
      await lockClubOwners(tx, input.clubId);
      if ((await countActiveOwners(tx, input.clubId)) > 0) {
        return err(new DomainError("conflict", "staff.owner_exists"));
      }
      const owner = {
        ...input,
        role: "owner",
        mustChangePassword: false,
        actor: "system",
      } as const;
      return ok(await insertStaff(tx, owner));
    }),
  );
}

export interface StandingChange {
  readonly clubId: string;
  readonly staffId: string;
  readonly next: Partial<StaffStanding>;
  readonly actor: StaffActor;
  readonly at: Date;
}

function standingAudit(
  current: StaffStanding,
  next: StaffStanding,
): { action: StaffAuditAction; fromState: string; toState: string }[] {
  const entries: { action: StaffAuditAction; fromState: string; toState: string }[] = [];
  if (current.role !== next.role) {
    entries.push({ action: "role_changed", fromState: current.role, toState: next.role });
  }
  if (current.status !== next.status) {
    const action = next.status === "disabled" ? "staff_disabled" : "staff_enabled";
    entries.push({ action, fromState: current.status, toState: next.status });
  }
  return entries;
}

async function applyStanding(tx: Tx, change: StandingChange): Promise<StaffAccount> {
  await lockClubOwners(tx, change.clubId);
  await lockStaff(tx, change.staffId);
  const row = await tx.staffUser.findFirst({
    where: { id: change.staffId, clubId: change.clubId },
  });
  if (row === null) {
    return abort(new DomainError("not_found", "staff.not_found"));
  }
  const next: StaffStanding = {
    role: change.next.role ?? row.role,
    status: change.next.status ?? row.status,
  };
  const allowed = assertOwnerRemains(row, next, await countActiveOwners(tx, change.clubId));
  if (!allowed.ok) {
    return abort(allowed.error);
  }
  const entries = standingAudit(row, next);
  if (entries.length === 0) {
    return toAccount(row);
  }
  const updated = await tx.staffUser.update({ where: { id: row.id }, data: next });
  await revokeAllStaffSessions(tx, row.id, change.at);
  const base = { clubId: change.clubId, staffId: row.id, actor: change.actor, at: change.at };
  for (const entry of entries) {
    await writeStaffAudit(tx, { ...base, ...entry });
  }
  return toAccount(updated);
}

/**
 * تغيير دور الموظف أو حالته. آخر مالك نشط لا يُعطَّل ولا يُنزَّل (فحص المجال، والمحفّز S1 سدًّا
 * أخيرًا). التغيير الفعلي يلغي كل جلسات الموظف، فصلاحياته الجديدة تسري من دخوله التالي.
 */
export async function changeStaffStanding(
  db: Db,
  change: StandingChange,
): Promise<Result<StaffAccount, DomainError>> {
  try {
    return await inTransaction(db, async (tx) => ok(await applyStanding(tx, change)));
  } catch (error) {
    if (constraintName(error) === STAFF_CONSTRAINTS.lastOwner) {
      return err(new DomainError("conflict", "staff.last_owner", { cause: error }));
    }
    throw error;
  }
}

export interface PasswordChange {
  readonly clubId: string;
  readonly staffId: string;
  readonly passwordHash: string;
  /** `password_changed`: صاحب الحساب غيّرها. `password_reset`: المالك أو أمر الخادم وضعها له. */
  readonly action: "password_changed" | "password_reset";
  /** كلمة مؤقتة يغيّرها صاحبها عند دخوله التالي. */
  readonly mustChangePassword: boolean;
  /** جلسة صاحب التغيير نفسه (بعد تدوير رمزها) تبقى؛ كل ما عداها يُلغى. */
  readonly keepSessionId?: string;
  readonly actor: StaffActor;
  readonly at: Date;
}

/** يكتب كلمة المرور الجديدة ويلغي جلسات صاحبها (عدا المستثناة) ويرفع القفل. */
export async function setStaffPassword(tx: Tx, change: PasswordChange): Promise<void> {
  const result = await tx.staffUser.updateMany({
    where: { id: change.staffId, clubId: change.clubId },
    data: {
      passwordHash: change.passwordHash,
      mustChangePassword: change.mustChangePassword,
      failedLogins: 0,
      lockedUntil: null,
    },
  });
  if (result.count === 0) {
    abort(new DomainError("not_found", "staff.not_found"));
  }
  // سر تسجيل معلّق (لم يؤكَّد) قد يكون رآه من عرف الكلمة القديمة: يُمحى، فيُولَّد سر جديد لصاحب الكلمة الجديدة
  await tx.staffUser.updateMany({
    where: { id: change.staffId, totpEnabledAt: null },
    data: { totpSecretEnc: null, totpLastStep: null },
  });
  await revokeAllStaffSessions(tx, change.staffId, change.at, change.keepSessionId);
  await writeStaffAudit(tx, {
    clubId: change.clubId,
    staffId: change.staffId,
    action: change.action,
    actor: change.actor,
    at: change.at,
  });
}
