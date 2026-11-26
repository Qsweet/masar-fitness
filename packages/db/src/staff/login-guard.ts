/** عدّاد المحاولات الفاشلة والقفل في القاعدة (ADMIN_DESIGN §4.6)، وتسجيل الدخول الناجح. */
import { afterFailedLogin, DomainError, isLockedOut, type FailedLoginOutcome } from "@masar/domain";
import type { Db } from "../client";
import { ensureTransaction, type Tx } from "../commerce/transaction";
import { lockStaff } from "./accounts";
import { staffActor, UNKNOWN_STAFF_ID, writeStaffAudit, type StaffActor } from "./audit";

export interface LoginAttempt {
  readonly staffId: string;
  readonly clubId: string;
  readonly ip: string;
  readonly at: Date;
}

/** ما فشل: كلمة المرور عند الدخول، أو رمز الخطوة الثانية، أو رمز الاسترجاع. العدّاد والقفل واحد. */
export type FailedCredential = "password" | "totp" | "recovery";

export interface FailedAttempt extends LoginAttempt {
  readonly credential: FailedCredential;
}

export type LoginFailureReason = "locked" | "disabled";

/**
 * يقفل صف الموظف ويقرأ حالته **تحت القفل**: هل يُقبل منه نجاح الآن (نشط وغير مقفل)؟ يُستدعى أول
 * معاملة النجاح (كلمة مرور صحيحة، رمز خطوة ثانية صحيح): فحص القفل قبل التجزئة قراءة قديمة، ومحاولة
 * صحيحة متزامنة مع الخامسة الخاطئة لا تدخل بعد أن قُفل الحساب.
 */
export async function lockUsableStaff(tx: Tx, staffId: string, now: Date): Promise<boolean> {
  await lockStaff(tx, staffId);
  const row = await tx.staffUser.findUnique({ where: { id: staffId } });
  return row !== null && row.status === "active" && !isLockedOut(row, now);
}

async function countFailure(tx: Tx, attempt: LoginAttempt): Promise<FailedLoginOutcome> {
  await lockStaff(tx, attempt.staffId);
  const row = await tx.staffUser.findUnique({ where: { id: attempt.staffId } });
  if (row === null) {
    throw new DomainError("invariant", "staff.missing_after_lock");
  }
  // مقفل الآن (قفلته محاولة متزامنة سبقت إلى قفل الصف): لا عدّ ولا كتابة، والقفل كما هو
  if (isLockedOut(row, attempt.at)) {
    return afterFailedLogin(row, attempt.at);
  }
  const outcome = afterFailedLogin(row, attempt.at);
  await tx.staffUser.update({
    where: { id: row.id },
    data: { failedLogins: outcome.failedLogins, lockedUntil: outcome.lockedUntil },
  });
  return outcome;
}

/**
 * محاولة خاطئة على حساب قائم غير مقفل (كلمة مرور أو رمز خطوة ثانية أو رمز استرجاع): تُعدّ تحت قفل
 * الصف (محاولتان متزامنتان تُعدّان اثنتين)، وتُسجَّل، والخامسة المتتالية تقفل وتُسجَّل قفلًا. العدّاد
 * واحد في القاعدة، فتخمين رموز الخطوة الثانية يقفل الحساب كما يقفله تخمين كلمة المرور.
 */
export function recordFailedAttempt(db: Db, attempt: FailedAttempt): Promise<FailedLoginOutcome> {
  return ensureTransaction(db, async (tx) => {
    const outcome = await countFailure(tx, attempt);
    const actor = staffActor(attempt.staffId);
    const base = { clubId: attempt.clubId, staffId: attempt.staffId, actor, at: attempt.at };
    const password = attempt.credential === "password";
    await writeStaffAudit(tx, {
      ...base,
      action: password ? "login_failed" : "mfa_failed",
      data: password
        ? { ip: attempt.ip, reason: "bad_password" }
        : { ip: attempt.ip, method: attempt.credential },
    });
    if (outcome.lockedNow) {
      await writeStaffAudit(tx, { ...base, action: "account_locked", data: { ip: attempt.ip } });
    }
    return outcome;
  });
}

export interface RejectedLogin {
  readonly clubId: string;
  /** null حين لا حساب بهذا البريد. */
  readonly staffId: string | null;
  readonly reason: LoginFailureReason | "unknown_account";
  readonly ip: string;
  readonly at: Date;
}

/** محاولة رُفضت بلا عدّ (حساب مقفل أو معطَّل أو غير موجود): تُسجَّل فقط. */
export async function recordRejectedLogin(db: Db, rejected: RejectedLogin): Promise<void> {
  const actor: StaffActor = rejected.staffId === null ? "system" : staffActor(rejected.staffId);
  await ensureTransaction(db, (tx) =>
    writeStaffAudit(tx, {
      clubId: rejected.clubId,
      staffId: rejected.staffId ?? UNKNOWN_STAFF_ID,
      action: "login_failed",
      actor,
      data: { ip: rejected.ip, reason: rejected.reason },
      at: rejected.at,
    }),
  );
}

export interface SuccessfulLogin extends LoginAttempt {
  /** تجزئة جديدة حين كانت المخزَّنة بمعاملات أضعف من الحالية. */
  readonly rehashedPassword?: string;
}

/**
 * كلمة المرور صحيحة: يُسجَّل وقت الدخول. العدّاد **لا يُصفَّر هنا**: من يعرف كلمة المرور ويخمّن رمز
 * الخطوة الثانية لا يمحو محاولاته الخاطئة بإعادة الدخول. التصفير عند إتمام الخطوة الثانية وحده
 * (`recordMfaVerified`، و`completeTotpEnrolment` لأول دخول).
 */
export async function recordPasswordAccepted(tx: Tx, login: SuccessfulLogin): Promise<void> {
  await tx.staffUser.update({
    where: { id: login.staffId },
    data: {
      lastLoginAt: login.at,
      ...(login.rehashedPassword === undefined ? {} : { passwordHash: login.rehashedPassword }),
    },
  });
  await writeStaffAudit(tx, {
    clubId: login.clubId,
    staffId: login.staffId,
    action: "login_succeeded",
    actor: staffActor(login.staffId),
    data: { ip: login.ip },
    at: login.at,
  });
}
