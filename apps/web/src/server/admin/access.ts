import {
  hasPermission,
  sessionStage,
  sessionStatus,
  type Permission,
  type SessionStage,
  type SessionTimes,
  type StaffRole,
  type StaffStatus,
} from "@masar/domain";
import { ADMIN_ROUTES } from "@/config/admin";

/**
 * قرار الوصول إلى اللوحة: منطق صرف يُختبر بلا Next. `guard.ts` ينفّذ القرار (404 أو تحويل).
 * الترتيب ثابت: اللوحة مفتوحة ← جلسة حيّة لحساب نشط ← المرحلة المطلوبة ← الصلاحية. الرفض هو الافتراضي.
 */
export type AccessDecision =
  | { readonly kind: "allow" }
  | { readonly kind: "not_found" }
  | { readonly kind: "redirect"; readonly to: string };

export const STAGE_ROUTES: Readonly<Record<SessionStage, string>> = {
  mfa_verify: ADMIN_ROUTES.verify,
  password_change: ADMIN_ROUTES.password,
  mfa_enrol: ADMIN_ROUTES.enrol,
  full: ADMIN_ROUTES.home,
};

/** الخروج متاح في كل مرحلة: من دخل بكلمة المرور ولم يكمل خطوته يستطيع إنهاء جلسته. */
export const ANY_STAGE = "any";
export type StageRequirement = SessionStage | typeof ANY_STAGE;

export interface SessionFacts extends SessionTimes {
  readonly mfaVerifiedAt: Date | null;
}

export interface StaffFacts {
  readonly role: StaffRole;
  readonly status: StaffStatus;
  readonly totpEnabled: boolean;
  readonly mustChangePassword: boolean;
}

/** هل الجلسة صالحة الآن لحساب نشط؟ خاملة أو منتهية أو ملغاة أو لحساب معطَّل = لا جلسة. */
export function isLiveSession(session: SessionFacts, staff: StaffFacts, now: Date): boolean {
  return staff.status === "active" && sessionStatus(session, now) === "active";
}

export function stageOf(session: SessionFacts, staff: StaffFacts): SessionStage {
  return sessionStage({
    mfaVerified: session.mfaVerifiedAt !== null,
    totpEnabled: staff.totpEnabled,
    mustChangePassword: staff.mustChangePassword,
  });
}

export interface AccessRequest {
  readonly adminEnabled: boolean;
  /** الجلسة الحيّة وصاحبها، أو null بلا جلسة. */
  readonly current: { readonly role: StaffRole; readonly stage: SessionStage } | null;
  readonly permission: Permission;
  /** المرحلة التي تخدمها الصفحة أو الإجراء؛ `full` لكل ما في اللوحة نفسها، و`any` للخروج وحده. */
  readonly stage: StageRequirement;
}

export function decideAccess(request: AccessRequest): AccessDecision {
  if (!request.adminEnabled) {
    return { kind: "not_found" };
  }
  if (request.current === null) {
    return { kind: "redirect", to: ADMIN_ROUTES.login };
  }
  if (request.stage !== ANY_STAGE && request.current.stage !== request.stage) {
    return { kind: "redirect", to: STAGE_ROUTES[request.current.stage] };
  }
  // بلا صلاحية: 404 لا 403، فلا يُعرف من الرد أن الصفحة موجودة
  return hasPermission(request.current.role, request.permission)
    ? { kind: "allow" }
    : { kind: "not_found" };
}
