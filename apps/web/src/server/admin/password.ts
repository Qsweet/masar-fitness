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
import { allowCurrentPasswordCheck } from "./throttle";

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

/**
 * يفحص الكلمة الحالية (حين تُطلب) وأن الجديدة ليست هي نفسها. محاولات الكلمة الحالية محدودة لكل حساب،
 * فجلسة مسروقة لا تخمّنها بلا حد. الكلمة المؤقتة لا تُقبل كلمةً جديدة: تغييرها الإلزامي تغيير فعلي.
 */
async function checkAgainstStored(
  change: OwnPasswordChange,
  newPassword: string,
): Promise<Result<null, DomainError>> {
  const stored = await findStaffCredentialsById(getDb(), change.context.staff.id);
  if (stored === null) {
    return err(new DomainError("unauthenticated", "staff.session_ended"));
  }
  if (change.currentPassword !== null) {
    if (!allowCurrentPasswordCheck(stored.id)) {
      return rejection("staff.too_many_attempts", "currentPassword");
    }
    const current = normalizePassword(change.currentPassword);
    if (!(await verifyPassword(current, stored.passwordHash))) {
      return rejection("staff.current_password_wrong", "currentPassword");
    }
  }
  if (await verifyPassword(newPassword, stored.passwordHash)) {
    return rejection("staff.password_same", "newPassword");
  }
  return ok(null);
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
  const allowed = await checkAgainstStored(change, checked.value);
  if (!allowed.ok) {
    return allowed;
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
