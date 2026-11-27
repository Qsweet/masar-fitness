import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/shell/admin-shell";
import {
  ADMIN_DENSITY_COOKIE,
  ADMIN_NAV_COLLAPSED,
  ADMIN_NAV_COOKIE,
  ADMIN_SHORTCUTS_COOKIE,
  ADMIN_THEME_COOKIE,
  parseAdminDensity,
  parseAdminTheme,
  shortcutsEnabled,
} from "@/config/admin";
import { getAdminDictionary } from "@/i18n/admin";
import { staffClub } from "@/server/admin/club";
import { requireStaff } from "@/server/admin/guard";
import { environmentBadge } from "@/server/admin/system-status";

/**
 * هيكل اللوحة لجلسة كاملة. الحارس هنا يعطي الهيكل صاحب الجلسة، ولا يغني عن حارس كل صفحة: التخطيط
 * لا يُعاد عرضه عند التنقل، فكل صفحة وكل إجراء يستدعي `requireStaff` بصلاحيته. حالة الشريط الجانبي
 * والمظهر والكثافة والاختصارات من كوكيات التفضيل، فيخرج الهيكل بها من الخادم.
 */
export default async function PanelLayout({ children }: { readonly children: ReactNode }) {
  const context = await requireStaff("account.self");
  const [jar, club] = await Promise.all([cookies(), staffClub(context.staff.clubId)]);
  const dictionary = getAdminDictionary();
  return (
    <AdminShell
      context={context}
      clubName={club?.nameAr ?? dictionary.brand.logoAlt}
      dictionary={dictionary}
      collapsed={jar.get(ADMIN_NAV_COOKIE)?.value === ADMIN_NAV_COLLAPSED}
      preferences={{
        theme: parseAdminTheme(jar.get(ADMIN_THEME_COOKIE)?.value),
        density: parseAdminDensity(jar.get(ADMIN_DENSITY_COOKIE)?.value),
        shortcuts: shortcutsEnabled(jar.get(ADMIN_SHORTCUTS_COOKIE)?.value),
      }}
      environment={environmentBadge()}
    >
      {children}
    </AdminShell>
  );
}
