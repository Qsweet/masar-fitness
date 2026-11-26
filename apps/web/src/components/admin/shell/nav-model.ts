import { hasPermission, type Permission, type StaffRole } from "@masar/domain";
import { ADMIN_ROUTES } from "@/config/admin";
import type { AdminDictionary } from "@/i18n/admin";
import type { AdminIconName } from "../admin-icon";

/**
 * أقسام اللوحة في مجموعاتها. المبني فقط: كل قسم بصلاحيته، وما لا يملكه الموظف لا يظهر له (والصفحة
 * نفسها ترفضه)، والمجموعة الفارغة لا تظهر. مجموعات المراحل القادمة (المبيعات، المحتوى، التسويق)
 * تُضاف هنا مع صفحاتها.
 */
export interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: AdminIconName;
}

export interface NavGroup {
  readonly id: string;
  readonly label: string;
  readonly items: readonly NavItem[];
}

type NavKey = "overview" | "staff" | "audit" | "account";
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
    id: "management",
    sections: [
      { key: "staff", href: ADMIN_ROUTES.staff, icon: "staff", permission: "staff.manage" },
      { key: "audit", href: ADMIN_ROUTES.audit, icon: "audit", permission: "audit.read" },
    ],
  },
  {
    id: "personal",
    sections: [
      { key: "account", href: ADMIN_ROUTES.account, icon: "account", permission: "account.self" },
    ],
  },
];

export function navGroupsFor(role: StaffRole, dictionary: AdminDictionary): NavGroup[] {
  return GROUPS.map((group) => ({
    id: group.id,
    label: dictionary.nav.groups[group.id],
    items: group.sections
      .filter((section) => hasPermission(role, section.permission))
      .map(({ key, href, icon }) => ({ href, icon, label: dictionary.nav[key] })),
  })).filter((group) => group.items.length > 0);
}

/** القسم الحالي: الرئيسية بمطابقة تامة، وغيرها ببادئة المسار (صفحة موظف داخل «الموظفون»). */
export function isCurrentSection(pathname: string, href: string): boolean {
  if (href === ADMIN_ROUTES.home) {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export interface Crumb {
  readonly href: string;
  readonly label: string;
}

/**
 * مسار التنقل من الرابط: كل مقطع له اسم معروف يصير حلقة، والمقطع المجهول تحت قسم معروف (معرّف
 * موظف) يأخذ اسم التفصيل العام. الجذر «اللوحة» دائمًا أولًا.
 */
export function breadcrumbTrail(
  pathname: string,
  labels: Readonly<Record<string, string>>,
  detailLabel: string,
): Crumb[] {
  const segments = pathname.split("/").filter((segment) => segment !== "");
  const trail: Crumb[] = [];
  let href = "";
  for (const segment of segments) {
    href = `${href}/${segment}`;
    const known = Object.hasOwn(labels, href) ? labels[href] : undefined;
    trail.push({ href, label: known ?? detailLabel });
  }
  return trail;
}
