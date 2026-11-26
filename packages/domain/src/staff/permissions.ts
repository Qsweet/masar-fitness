import type { StaffRole } from "./roles";

/**
 * صلاحيات لوحة التحكم. تُضاف صلاحيات كل مرحلة معها (`catalog.*`, `orders.*`, `content.*`…).
 * `overview.read`: أرقام الطلبات في «نظرة عامة»، وهي بيانات مبيعات لا يراها المحرر (القرار 62).
 * `system.read`: بطاقة حالة النظام (الشراء، الدفع، الفهرسة، الإصدار) للمالك والمدير (القرار 64).
 * صلاحيات المبيعات (ADMIN_A2_SALES §2): `orders.settle` تسجيل دفع يدوي يفعّل اشتراكًا بلا تحقق مزوّد،
 * فهي للمالك والمدير وحدهما؛ و`sales.settings` سياسات مختومة على كل طلب، فهي للمالك وحده.
 */
export const PERMISSIONS = [
  "staff.manage",
  "audit.read",
  "overview.read",
  "system.read",
  "account.self",
  "catalog.read",
  "catalog.write",
  "catalog.publish",
  "promotions.read",
  "promotions.write",
  "orders.read",
  "orders.cancel",
  "orders.settle",
  "customers.read",
  "customers.reveal_phone",
  "sales.settings",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/**
 * خريطة الأدوار. الرفض هو الافتراضي: ما ليس مذكورًا هنا ممنوع.
 * المالك كل شيء؛ المدير كل شيء عدا إدارة الموظفين (والربط والمفاتيح حين تُبنى)؛ المحرر المحتوى
 * والمدونة (A3/A4)؛ المبيعات الطلبات والعملاء (A2).
 */
/** ما يقرؤه دور المبيعات ويفعله: يرى ويلغي معلّقًا ويكشف جوالًا، ولا يغيّر سعرًا ولا يسجّل دفعًا. */
const SALES_DESK: readonly Permission[] = [
  "catalog.read",
  "promotions.read",
  "orders.read",
  "orders.cancel",
  "customers.read",
  "customers.reveal_phone",
];

/** ما يزيده المدير على المبيعات: الكتابة في الكتالوج والعروض، وتسجيل الدفع اليدوي. */
const SALES_MANAGEMENT: readonly Permission[] = [
  ...SALES_DESK,
  "catalog.write",
  "catalog.publish",
  "promotions.write",
  "orders.settle",
];

const ROLE_PERMISSIONS: Readonly<Record<StaffRole, readonly Permission[]>> = {
  owner: [
    "staff.manage",
    "audit.read",
    "overview.read",
    "system.read",
    "account.self",
    ...SALES_MANAGEMENT,
    "sales.settings",
  ],
  manager: ["audit.read", "overview.read", "system.read", "account.self", ...SALES_MANAGEMENT],
  editor: ["account.self"],
  sales: ["overview.read", "account.self", ...SALES_DESK],
};

export function hasPermission(role: StaffRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function permissionsOf(role: StaffRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}
