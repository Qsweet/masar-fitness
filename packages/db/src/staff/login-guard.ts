/** عدّاد المحاولات الفاشلة والقفل في القاعدة (ADMIN_DESIGN §4.6)، وتسجيل الدخول الناجح. */
import {
  afterFailedLogin,
  CLEARED_LOGIN_GUARD,
  DomainError,
  type FailedLoginOutcome,
} from "@masar/domain";
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

export type LoginFailureReason = "locked" | "disabled";

async function countFailure(tx: Tx, attempt: LoginAttempt): Promise<FailedLoginOutcome> {
  await lockStaff(tx, attempt.staffId);
  const row = await tx.staffUser.findUnique({ where: { id: attempt.staffId } });
  if (row === null) {
    throw new DomainError("invariant", "staff.missing_after_lock");
  }
  const outcome = afterFailedLogin(row, attempt.at);
  await tx.staffUser.update({
    where: { id: row.id },
    data: { failedLogins: outcome.failedLogins, lockedUntil: outcome.lockedUntil },
  });
  return outcome;
}

/**
 * محاولة بكلمة خاطئة على حساب قائم غير مقفل: تُعدّ تحت قفل الصف (محاولتان متزامنتان تُعدّان
 * اثنتين)، وتُسجَّل، والخامسة تقفل وتُسجَّل قفلًا.
 */
export function recordFailedPassword(db: Db, attempt: LoginAttempt): Promise<FailedLoginOutcome> {
  return ensureTransaction(db, async (tx) => {
    const outcome = await countFailure(tx, attempt);
    const actor = staffActor(attempt.staffId);
    const base = { clubId: attempt.clubId, staffId: attempt.staffId, actor, at: attempt.at };
    await writeStaffAudit(tx, {
      ...base,
      action: "login_failed",
      data: { ip: attempt.ip, reason: "bad_password" },
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

/** كلمة المرور صحيحة: يُصفَّر العدّاد ويُسجَّل وقت الدخول. */
export async function recordPasswordAccepted(tx: Tx, login: SuccessfulLogin): Promise<void> {
  await tx.staffUser.update({
    where: { id: login.staffId },
    data: {
      ...CLEARED_LOGIN_GUARD,
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
