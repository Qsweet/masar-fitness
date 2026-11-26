import type { StaffRole } from "./roles";

/**
 * صلاحيات لوحة التحكم. تُضاف صلاحيات كل مرحلة معها (`catalog.*`, `orders.*`, `content.*`…).
 * `overview.read`: أرقام طلبات اليوم في «نظرة عامة»، وهي بيانات مبيعات لا يراها المحرر (القرار 62).
 */
export const PERMISSIONS = ["staff.manage", "audit.read", "overview.read", "account.self"] as const;
export type Permission = (typeof PERMISSIONS)[number];

/**
 * خريطة الأدوار. الرفض هو الافتراضي: ما ليس مذكورًا هنا ممنوع.
 * المالك كل شيء؛ المدير كل شيء عدا إدارة الموظفين (والربط والمفاتيح حين تُبنى)؛ المحرر المحتوى
 * والمدونة (A3/A4)؛ المبيعات الطلبات والعملاء (A2).
 */
const ROLE_PERMISSIONS: Readonly<Record<StaffRole, readonly Permission[]>> = {
  owner: ["staff.manage", "audit.read", "overview.read", "account.self"],
  manager: ["audit.read", "overview.read", "account.self"],
  editor: ["account.self"],
  sales: ["overview.read", "account.self"],
};

export function hasPermission(role: StaffRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function permissionsOf(role: StaffRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}
