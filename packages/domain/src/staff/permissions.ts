import type { StaffRole } from "./roles";

/**
 * صلاحيات لوحة التحكم. تُضاف صلاحيات كل مرحلة معها (`catalog.*`, `orders.*`, `content.*`…).
 * `overview.read`: أرقام الطلبات في «نظرة عامة»، وهي بيانات مبيعات لا يراها المحرر (القرار 62).
 * `system.read`: بطاقة حالة النظام (الشراء، الدفع، الفهرسة، الإصدار) للمالك والمدير (القرار 64).
 * صلاحيات المبيعات (ADMIN_A2_SALES §2): `orders.settle` تسجيل دفع يدوي يفعّل اشتراكًا بلا تحقق مزوّد،
 * فهي للمالك والمدير وحدهما؛ و`sales.settings` سياسات مختومة على كل طلب، فهي للمالك وحده.
 * صلاحيات المحتوى (ADMIN_A3_CONTENT §2): القراءة (ومعها المعاينة) والكتابة في المسودة للمحرر أيضًا؛
 * `content.facts` اسم النادي وحقائقه (خطأ فيها يدّعي أو يضلّل)، و`content.publish` ما يغيّر الموقع
 * الحي (النشر والاسترجاع وتجاهل المسودة)، فهما للمالك والمدير. `content.purge` حذف صورة من المكتبة
 * نهائيًا (لا رجعة فيه)، فهو للمالك وحده (ADMIN_A3_SLIDER §6.3).
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
  "content.read",
  "content.write",
  "content.facts",
  "content.publish",
  "content.purge",
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

/** ما يكتبه المحرر: المسودة ومعاينتها، بلا نشر ولا حقائق النادي. */
const CONTENT_EDITING: readonly Permission[] = ["content.read", "content.write"];

/** ما يزيده المدير على المحرر في المحتوى. */
const CONTENT_MANAGEMENT: readonly Permission[] = [
  ...CONTENT_EDITING,
  "content.facts",
  "content.publish",
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
    ...CONTENT_MANAGEMENT,
    "content.purge",
  ],
  manager: [
    "audit.read",
    "overview.read",
    "system.read",
    "account.self",
    ...SALES_MANAGEMENT,
    ...CONTENT_MANAGEMENT,
  ],
  editor: ["account.self", ...CONTENT_EDITING],
  sales: ["overview.read", "account.self", ...SALES_DESK],
};

export function hasPermission(role: StaffRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function permissionsOf(role: StaffRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}
