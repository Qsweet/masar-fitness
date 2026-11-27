import { hasPermission, type Permission, type StaffRole } from "@masar/domain";
import { ADMIN_ROUTES } from "@/config/admin";
import type { AdminDictionary } from "@/i18n/admin";
import type { AdminIconName } from "../admin-icon";

/**
 * أقسام اللوحة في مجموعاتها. المبني فقط: كل قسم بصلاحيته، وما لا يملكه الموظف لا يظهر له (والصفحة
 * نفسها ترفضه)، والمجموعة الفارغة لا تظهر. مجموعات المراحل القادمة (التسويق وما بعده) تُضاف هنا مع
 * صفحاتها.
 */
export interface NavItem {
  readonly key: NavKey;
  readonly href: string;
  readonly label: string;
  readonly icon: AdminIconName;
}

export interface NavGroup {
  readonly id: string;
  readonly label: string;
  readonly items: readonly NavItem[];
}

export type NavKey =
  | "overview"
  | "orders"
  | "customers"
  | "plans"
  | "promotions"
  | "salesSettings"
  | "contentTexts"
  | "contentSlider"
  | "contentMedia"
  | "contentPublishing"
  | "staff"
  | "audit"
  | "integrations"
  | "account";
type GroupKey = keyof AdminDictionary["nav"]["groups"];

interface Section {
  readonly key: NavKey;
  readonly href: string;
  readonly icon: AdminIconName;
  readonly permission: Permission;
}

const GROUPS: readonly { readonly id: GroupKey; readonly sections: readonly Section[] }[] = [
  {
    id: "general",
    sections: [
      { key: "overview", href: ADMIN_ROUTES.home, icon: "overview", permission: "overview.read" },
    ],
  },
  {
    id: "sales",
    sections: [
      { key: "orders", href: ADMIN_ROUTES.orders, icon: "orders", permission: "orders.read" },
      {
        key: "customers",
        href: ADMIN_ROUTES.customers,
        icon: "customers",
        permission: "customers.read",
      },
      { key: "plans", href: ADMIN_ROUTES.plans, icon: "plans", permission: "catalog.read" },
      {
        key: "promotions",
        href: ADMIN_ROUTES.promotions,
        icon: "promotions",
        permission: "promotions.read",
      },
      {
        key: "salesSettings",
        href: ADMIN_ROUTES.salesSettings,
        icon: "settings",
        permission: "sales.settings",
      },
    ],
  },
  {
    id: "content",
    sections: [
      {
        key: "contentTexts",
        href: ADMIN_ROUTES.contentTexts,
        icon: "texts",
        permission: "content.read",
      },
      {
        key: "contentSlider",
        href: ADMIN_ROUTES.contentSlider,
        icon: "slider",
        permission: "content.read",
      },
      {
        key: "contentMedia",
        href: ADMIN_ROUTES.contentMedia,
        icon: "image",
        permission: "content.read",
      },
      {
        key: "contentPublishing",
        href: ADMIN_ROUTES.content,
        icon: "publish",
        permission: "content.read",
      },
    ],
  },
  {
    id: "management",
    sections: [
      { key: "staff", href: ADMIN_ROUTES.staff, icon: "staff", permission: "staff.manage" },
      { key: "audit", href: ADMIN_ROUTES.audit, icon: "audit", permission: "audit.read" },
      {
        key: "integrations",
        href: ADMIN_ROUTES.integrations,
        icon: "plug",
        permission: "integrations.manage",
      },
    ],
  },
  {
    id: "personal",
    sections: [
      { key: "account", href: ADMIN_ROUTES.account, icon: "account", permission: "account.self" },
    ],
  },
];

/** مجموعة «الحساب»: في الدرج على الهاتف، وفي قائمة الحساب على الشاشة الواسعة (§4.1). */
export const PERSONAL_GROUP: GroupKey = "personal";

export function navGroupsFor(role: StaffRole, dictionary: AdminDictionary): NavGroup[] {
  return GROUPS.map((group) => ({
    id: group.id,
    label: dictionary.nav.groups[group.id],
    items: group.sections
      .filter((section) => hasPermission(role, section.permission))
      .map(({ key, href, icon }) => ({ key, href, icon, label: dictionary.nav[key] })),
  })).filter((group) => group.items.length > 0);
}

const isUnderPath = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

/**
 * أقسام جذرها يشمل أقسامًا أخرى: تطابق نفسها ومساراتها المعلنة وحدها («النشر والسجل» في ‎/admin/content‎
 * لا تُعلَّم حالية في ‎/admin/content/texts‎).
 */
const OWNED_PATHS: Readonly<Record<string, readonly string[]>> = {
  [ADMIN_ROUTES.home]: [],
  [ADMIN_ROUTES.content]: [
    ADMIN_ROUTES.contentPublish,
    ADMIN_ROUTES.contentHistory,
    ADMIN_ROUTES.contentDiscard,
  ],
};

/** القسم الحالي: الرئيسية بمطابقة تامة، وغيرها ببادئة المسار (صفحة موظف داخل «الموظفون»). */
export function isCurrentSection(pathname: string, href: string): boolean {
  const owned = Object.hasOwn(OWNED_PATHS, href) ? OWNED_PATHS[href] : undefined;
  if (owned !== undefined) {
    return pathname === href || owned.some((path) => isUnderPath(pathname, path));
  }
  return isUnderPath(pathname, href);
}

export interface Crumb {
  readonly href: string;
  readonly label: string;
}

const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ANY_ID = "*";

/**
 * مسار التنقل من الرابط: كل مقطع له اسم معروف يصير حلقة. المعرّف في الرابط يُطابَق بـ‎`*`‎ في خريطة
 * الأسماء («‎/admin/sales/orders/*‎» و«‎/admin/sales/orders/*‎/cancel»)، وما لا اسم له يأخذ الاسم
 * العام. الجذر «اللوحة» دائمًا أولًا.
 */
export function breadcrumbTrail(
  pathname: string,
  labels: Readonly<Record<string, string>>,
  detailLabel: string,
): Crumb[] {
  const segments = pathname.split("/").filter((segment) => segment !== "");
  const trail: Crumb[] = [];
  let href = "";
  let pattern = "";
  for (const segment of segments) {
    href = `${href}/${segment}`;
    pattern = `${pattern}/${UUID_SEGMENT.test(segment) ? ANY_ID : segment}`;
    const key = Object.hasOwn(labels, href) ? href : pattern;
    const known = Object.hasOwn(labels, key) ? labels[key] : undefined;
    trail.push({ href, label: known ?? detailLabel });
  }
  return trail;
}
