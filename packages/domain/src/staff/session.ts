/** عمر جلسة الموظف ومرحلتها (ADMIN_DESIGN §4.5). منطق صرف: الوقت يُمرَّر ولا يُقرأ. */
export const SESSION_IDLE_MINUTES = 30;
export const SESSION_ABSOLUTE_HOURS = 12;

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;

export const SESSION_IDLE_MS = SESSION_IDLE_MINUTES * MS_PER_MINUTE;
export const SESSION_ABSOLUTE_MS = SESSION_ABSOLUTE_HOURS * MINUTES_PER_HOUR * MS_PER_MINUTE;

export interface SessionTimes {
  readonly lastSeenAt: Date;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
}

export type SessionStatus = "active" | "revoked" | "expired" | "idle";

/** الحد المطلق من لحظة الدخول، ولا يتمدد بالنشاط ولا بتدوير الرمز. */
export function sessionExpiry(loginAt: Date): Date {
  return new Date(loginAt.getTime() + SESSION_ABSOLUTE_MS);
}

export function sessionStatus(session: SessionTimes, now: Date): SessionStatus {
  if (session.revokedAt !== null) {
    return "revoked";
  }
  if (session.expiresAt.getTime() <= now.getTime()) {
    return "expired";
  }
  if (now.getTime() - session.lastSeenAt.getTime() >= SESSION_IDLE_MS) {
    return "idle";
  }
  return "active";
}

/**
 * ما تفتحه الجلسة الآن. قبل الخطوة الثانية لا تفتح إلا التحقق أو التسجيل أو تغيير كلمة المرور
 * الإلزامي، و`full` وحدها تفتح اللوحة.
 */
export const SESSION_STAGES = ["mfa_verify", "password_change", "mfa_enrol", "full"] as const;
export type SessionStage = (typeof SESSION_STAGES)[number];

export interface StageInput {
  readonly mfaVerified: boolean;
  readonly totpEnabled: boolean;
  readonly mustChangePassword: boolean;
}

/**
 * الترتيب: من له خطوة ثانية يثبتها أولًا. من ليست له (موظف جديد أو بعد إعادة الضبط) يغيّر كلمته
 * المؤقتة ثم يسجّل الخطوة الثانية. لا طريق إلى `full` بلا خطوة ثانية مثبتة في هذه الجلسة.
 */
export function sessionStage(input: StageInput): SessionStage {
  if (input.totpEnabled && !input.mfaVerified) {
    return "mfa_verify";
  }
  if (input.mustChangePassword) {
    return "password_change";
  }
  return input.totpEnabled ? "full" : "mfa_enrol";
}
