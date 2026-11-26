import "server-only";
import {
  findStaffCredentialsById,
  hashPassword,
  inTransaction,
  issueSessionToken,
  rotateStaffSession,
  setStaffPassword,
  staffActor,
  verifyPassword,
} from "@masar/db";
import {
  checkPasswordPolicy,
  DomainError,
  err,
  normalizePassword,
  ok,
  type Result,
} from "@masar/domain";
import { getDb } from "../db";
import { passwordForbiddenWords } from "./club";
import type { IssuedSession } from "./login";
import type { StaffContext } from "./session";

export interface OwnPasswordChange {
  readonly context: StaffContext;
  /** الكلمة الحالية: إلزامية عند التغيير الاختياري من «حسابي»، وغير مطلوبة عند التغيير الإلزامي. */
  readonly currentPassword: string | null;
  readonly newPassword: string;
  readonly confirmation: string;
  readonly now: Date;
}

function rejection(reason: string, field: string): Result<never, DomainError> {
  return err(new DomainError("validation", reason, { field }));
}

async function checkCurrent(change: OwnPasswordChange): Promise<boolean> {
  if (change.currentPassword === null) {
    return true;
  }
  const staff = await findStaffCredentialsById(getDb(), change.context.staff.id);
  const current = normalizePassword(change.currentPassword);
  return staff !== null && (await verifyPassword(current, staff.passwordHash));
}

/**
 * الموظف يغيّر كلمة مروره: تُفحص السياسة، وتُلغى كل جلساته الأخرى، وجلسته هذه تبقى برمز جديد
 * (docs/ADMIN_DESIGN.md §4.5). يرجع الجلسة الجديدة ليكتبها الإجراء في الكوكي.
 */
export async function changeOwnPassword(
  change: OwnPasswordChange,
): Promise<Result<IssuedSession, DomainError>> {
  const { staff, session } = change.context;
  if (change.newPassword !== change.confirmation) {
    return rejection("staff.password_mismatch", "confirmation");
  }
  const checked = checkPasswordPolicy({
    password: change.newPassword,
    email: staff.email,
    forbiddenWords: await passwordForbiddenWords(staff.clubId),
  });
  if (!checked.ok) {
    return checked;
  }
  if (!(await checkCurrent(change))) {
    return rejection("staff.current_password_wrong", "currentPassword");
  }
  const passwordHash = await hashPassword(checked.value);
  const issued = issueSessionToken();
  return inTransaction(getDb(), async (tx) => {
    const keepSessionId = await rotateStaffSession(tx, {
      sessionId: session.id,
      tokenHash: issued.tokenHash,
      now: change.now,
    });
    if (keepSessionId === null) {
      return err(new DomainError("unauthenticated", "staff.session_ended"));
    }
    await setStaffPassword(tx, {
      clubId: staff.clubId,
      staffId: staff.id,
      passwordHash,
      action: "password_changed",
      mustChangePassword: false,
      keepSessionId,
      actor: staffActor(staff.id),
      at: change.now,
    });
    return ok({ token: issued.token, expiresAt: session.expiresAt });
  });
}
