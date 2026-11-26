import "server-only";
import type { Permission } from "@masar/domain";
import { notFound, redirect } from "next/navigation";
import { decideAccess, type StageRequirement } from "./access";
import { isAdminEnabled } from "./flag";
import { currentStaffSession, type StaffContext } from "./session";

/**
 * الحارس الوحيد للوحة: أول سطر في كل صفحة وكل Server Action تحت ‎/admin‎ (عدا الدخول)، ويفحصه
 * `guard-coverage.test.ts`. الرفض هو الافتراضي: لوحة مغلقة أو صلاحية ناقصة ⇒ 404، وبلا جلسة ⇒ صفحة
 * الدخول، وجلسة لم تكمل خطوتها ⇒ صفحة تلك الخطوة وحدها.
 *
 * `stage` يحدد المرحلة التي تخدمها الصفحة: `full` (الافتراضي) لكل ما في اللوحة، وغيرها لصفحات
 * التحقق والتسجيل وتغيير كلمة المرور الإلزامي، فلا تفتح جلسة قبل الخطوة الثانية أي شيء آخر.
 * `any` للخروج وحده.
 */
export async function requireStaff(
  permission: Permission,
  stage: StageRequirement = "full",
): Promise<StaffContext> {
  const adminEnabled = isAdminEnabled();
  const current = adminEnabled ? await currentStaffSession() : null;
  const decision = decideAccess({
    adminEnabled,
    current: current === null ? null : { role: current.staff.role, stage: current.stage },
    permission,
    stage,
  });
  if (decision.kind === "redirect") {
    redirect(decision.to);
  }
  if (decision.kind === "not_found" || current === null) {
    notFound();
  }
  return current;
}
