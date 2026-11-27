/** قراءة حسابات الموظفين. الحقول السرية (التجزئة، السر المشفّر) لا تخرج إلا في `StaffCredentials`. */
import type { StaffRole, StaffStatus } from "@masar/domain";
import type { Db } from "../client";
import type { Tx } from "../commerce/transaction";
import type { StaffUser } from "../generated/prisma/client";

export interface StaffAccount {
  readonly id: string;
  readonly clubId: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: StaffRole;
  readonly status: StaffStatus;
  readonly mustChangePassword: boolean;
  /** الخطوة الثانية مؤكَّدة (لا سر معلّق فقط). */
  readonly totpEnabled: boolean;
  readonly lockedUntil: Date | null;
  readonly lastLoginAt: Date | null;
  readonly createdAt: Date;
}

/** ما يحتاجه مسار الدخول والتحقق فقط؛ لا يُمرَّر إلى واجهة. */
export interface StaffCredentials extends StaffAccount {
  readonly passwordHash: string;
  readonly totpSecretEnc: string | null;
  readonly totpLastStep: number | null;
  readonly failedLogins: number;
}

export function toAccount(row: StaffUser): StaffAccount {
  return {
    id: row.id,
    clubId: row.clubId,
    email: row.email,
    displayName: row.displayName,
    role: row.role,
    status: row.status,
    mustChangePassword: row.mustChangePassword,
    totpEnabled: row.totpEnabledAt !== null,
    lockedUntil: row.lockedUntil,
    lastLoginAt: row.lastLoginAt,
    createdAt: row.createdAt,
  };
}

function toCredentials(row: StaffUser): StaffCredentials {
  return {
    ...toAccount(row),
    passwordHash: row.passwordHash,
    totpSecretEnc: row.totpSecretEnc,
    // الخطوة الزمنية أصغر بكثير من 2^53، والعمود BIGINT احتياط لا أكثر
    totpLastStep: row.totpLastStep === null ? null : Number(row.totpLastStep),
    failedLogins: row.failedLogins,
  };
}

export async function findStaffCredentialsByEmail(
  db: Db | Tx,
  email: string,
): Promise<StaffCredentials | null> {
  const row = await db.staffUser.findUnique({ where: { email } });
  return row === null ? null : toCredentials(row);
}

export async function findStaffCredentialsById(
  db: Db | Tx,
  id: string,
): Promise<StaffCredentials | null> {
  const row = await db.staffUser.findUnique({ where: { id } });
  return row === null ? null : toCredentials(row);
}

/** موظف من النادي نفسه فقط: معرّف من نادٍ آخر كأنه غير موجود. */
export async function findStaffInClub(
  db: Db | Tx,
  clubId: string,
  id: string,
): Promise<StaffAccount | null> {
  const row = await db.staffUser.findFirst({ where: { id, clubId } });
  return row === null ? null : toAccount(row);
}

export async function listStaff(db: Db | Tx, clubId: string): Promise<StaffAccount[]> {
  const rows = await db.staffUser.findMany({ where: { clubId }, orderBy: { createdAt: "asc" } });
  return rows.map(toAccount);
}

export async function countActiveOwners(db: Db | Tx, clubId: string): Promise<number> {
  return db.staffUser.count({ where: { clubId, role: "owner", status: "active" } });
}

/** أقدم مالك نشط للنادي: تُنسب إليه أوامر الخادم التي تكتب محتوى (عدّة الشريط). */
export async function oldestActiveOwnerId(db: Db | Tx, clubId: string): Promise<string | null> {
  const row = await db.staffUser.findFirst({
    where: { clubId, role: "owner", status: "active" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  return row?.id ?? null;
}

/** يقفل صف الموظف حتى نهاية المعاملة: نقطة التسلسل لعدّ المحاولات وتغيير الحالة. */
export async function lockStaff(tx: Tx, id: string): Promise<void> {
  await tx.$queryRaw`SELECT id::text AS id FROM staff_users WHERE id = ${id}::uuid FOR UPDATE`;
}

/** يسلسل تغييرات المالكين في النادي (المفتاح نفسه في المحفّز S1). */
export async function lockClubOwners(tx: Tx, clubId: string): Promise<void> {
  const key = `staff_owners:${clubId}`;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}::text, 0))::text AS locked`;
}
