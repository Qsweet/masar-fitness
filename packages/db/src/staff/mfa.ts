/**
 * الخطوة الثانية في القاعدة (ADMIN_DESIGN §4.4): السر المعلّق والتفعيل، ومنع إعادة الرمز ذرّيًا،
 * ورموز الاسترجاع مرة واحدة، وإعادة الضبط.
 */
import { CLEARED_LOGIN_GUARD, DomainError } from "@masar/domain";
import type { Db } from "../client";
import { abort, type Tx } from "../commerce/transaction";
import type { StaffAccount } from "./accounts";
import { staffActor, writeStaffAudit, type StaffActor } from "./audit";
import { revokeAllStaffSessions } from "./sessions";

type StaffRef = Pick<StaffAccount, "id" | "clubId">;

/** يحفظ سرًا معلّقًا لحساب لم يفعّل الخطوة الثانية بعد. true إن كُتب؛ false إن كانت مفعّلة. */
export async function savePendingTotpSecret(
  db: Db | Tx,
  staffId: string,
  secretEnc: string,
): Promise<boolean> {
  const result = await db.staffUser.updateMany({
    where: { id: staffId, totpEnabledAt: null },
    data: { totpSecretEnc: secretEnc, totpLastStep: null },
  });
  return result.count === 1;
}

/**
 * يقبل خطوة زمنية مرة واحدة: التحديث يشترط أنها أحدث من آخر خطوة مقبولة، فطلبان متزامنان بالرمز
 * نفسه ينجح أحدهما فقط. يرجع هل قُبلت.
 */
export async function acceptTotpStep(db: Db | Tx, staffId: string, step: number): Promise<boolean> {
  const updated = await db.$executeRaw`
    UPDATE staff_users SET totp_last_step = ${step}::bigint
    WHERE id = ${staffId}::uuid AND totp_secret_enc IS NOT NULL
      AND (totp_last_step IS NULL OR totp_last_step < ${step}::bigint)`;
  return updated === 1;
}

export interface TotpEnrolment {
  readonly staff: StaffRef;
  /** خطوة رمز التأكيد: تُحفظ فلا يُستعمل الرمز نفسه للدخول بعدها. */
  readonly step: number;
  readonly recoveryCodeHashes: readonly string[];
  readonly at: Date;
}

/** يفعّل الخطوة الثانية برمز تأكيد مقبول، ويستبدل رموز الاسترجاع. يتراجع إن كانت مفعّلة أصلًا. */
export async function completeTotpEnrolment(tx: Tx, enrolment: TotpEnrolment): Promise<void> {
  const { staff, at } = enrolment;
  const enabled = await tx.staffUser.updateMany({
    where: { id: staff.id, totpEnabledAt: null, totpSecretEnc: { not: null } },
    data: { totpEnabledAt: at, totpLastStep: BigInt(enrolment.step) },
  });
  if (enabled.count === 0) {
    abort(new DomainError("conflict", "staff.mfa_already_enrolled"));
  }
  await tx.staffRecoveryCode.deleteMany({ where: { staffUserId: staff.id } });
  await tx.staffRecoveryCode.createMany({
    data: enrolment.recoveryCodeHashes.map((codeHash) => ({ staffUserId: staff.id, codeHash })),
  });
  await writeStaffAudit(tx, {
    clubId: staff.clubId,
    staffId: staff.id,
    action: "mfa_enrolled",
    actor: staffActor(staff.id),
    at,
  });
}

export interface RecoveryCodeUse {
  readonly staff: StaffRef;
  readonly codeHash: string;
  readonly at: Date;
}

/** يستهلك رمز استرجاع غير مستعمل ويسجّله مع عدد الباقي. false إن لم يوجد أو استُعمل. */
export async function consumeRecoveryCode(tx: Tx, use: RecoveryCodeUse): Promise<boolean> {
  const { staff, at } = use;
  const consumed = await tx.staffRecoveryCode.updateMany({
    where: { staffUserId: staff.id, codeHash: use.codeHash, usedAt: null },
    data: { usedAt: at },
  });
  if (consumed.count === 0) {
    return false;
  }
  const remaining = await tx.staffRecoveryCode.count({
    where: { staffUserId: staff.id, usedAt: null },
  });
  await writeStaffAudit(tx, {
    clubId: staff.clubId,
    staffId: staff.id,
    action: "recovery_code_used",
    actor: staffActor(staff.id),
    data: { remaining },
    at,
  });
  return true;
}

export interface TotpReset {
  readonly staff: StaffRef;
  readonly actor: StaffActor;
  readonly at: Date;
}

/** يمحو السر ورموز الاسترجاع ويلغي الجلسات: الموظف يسجّل خطوته الثانية من جديد عند دخوله التالي. */
export async function resetTotp(tx: Tx, reset: TotpReset): Promise<void> {
  const { staff, at } = reset;
  const result = await tx.staffUser.updateMany({
    where: { id: staff.id, clubId: staff.clubId },
    data: { totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null },
  });
  if (result.count === 0) {
    abort(new DomainError("not_found", "staff.not_found"));
  }
  await tx.staffRecoveryCode.deleteMany({ where: { staffUserId: staff.id } });
  await revokeAllStaffSessions(tx, staff.id, at);
  await writeStaffAudit(tx, {
    clubId: staff.clubId,
    staffId: staff.id,
    action: "mfa_reset",
    actor: reset.actor,
    at,
  });
}

export interface MfaVerified {
  readonly staff: StaffRef;
  readonly method: "totp" | "recovery";
  readonly ip: string;
  readonly at: Date;
}

/** الخطوة الثانية نجحت: يُصفَّر عدّاد المحاولات الفاشلة ويُسجَّل النجاح بطريقته. */
export async function recordMfaVerified(tx: Tx, verified: MfaVerified): Promise<void> {
  await tx.staffUser.update({ where: { id: verified.staff.id }, data: CLEARED_LOGIN_GUARD });
  await writeStaffAudit(tx, {
    clubId: verified.staff.clubId,
    staffId: verified.staff.id,
    action: "mfa_verified",
    actor: staffActor(verified.staff.id),
    data: { ip: verified.ip, method: verified.method },
    at: verified.at,
  });
}
