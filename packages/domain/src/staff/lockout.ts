/** قفل الحساب بعد محاولات دخول فاشلة متتالية (ADMIN_DESIGN §4.6). الحالة في القاعدة فتصمد لإعادة التشغيل. */
export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MINUTES = 15;

const MS_PER_MINUTE = 60_000;

export interface LoginGuardState {
  readonly failedLogins: number;
  readonly lockedUntil: Date | null;
}

export interface FailedLoginOutcome extends LoginGuardState {
  /** هذه المحاولة هي التي أقفلت الحساب (تُسجَّل في التدقيق مرة). */
  readonly lockedNow: boolean;
}

/** الحالة بعد دخول ناجح: يُصفَّر العدّاد ويُرفع القفل. */
export const CLEARED_LOGIN_GUARD: LoginGuardState = { failedLogins: 0, lockedUntil: null };

export function isLockedOut(state: LoginGuardState, now: Date): boolean {
  return state.lockedUntil !== null && state.lockedUntil.getTime() > now.getTime();
}

/**
 * محاولة فاشلة. الخامسة المتتالية تقفل 15 دقيقة ويبدأ العدّ من جديد بعدها، فلا يبقى الحساب على حافة
 * القفل إلى الأبد. والحساب مقفل الآن: لا تُعدّ المحاولة ولا يُمسّ القفل، فمحاولات متزامنة تصل بعد
 * القفل (فحصت الحالة قبله) لا تمحوه ولا تمدّه.
 */
export function afterFailedLogin(state: LoginGuardState, now: Date): FailedLoginOutcome {
  if (isLockedOut(state, now)) {
    return { failedLogins: state.failedLogins, lockedUntil: state.lockedUntil, lockedNow: false };
  }
  const failedLogins = state.failedLogins + 1;
  if (failedLogins < MAX_FAILED_LOGINS) {
    return { failedLogins, lockedUntil: null, lockedNow: false };
  }
  const lockedUntil = new Date(now.getTime() + LOCKOUT_MINUTES * MS_PER_MINUTE);
  return { failedLogins: 0, lockedUntil, lockedNow: true };
}
