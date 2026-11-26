import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/shell/admin-shell";
import {
  ADMIN_NAV_COLLAPSED,
  ADMIN_NAV_COOKIE,
  ADMIN_THEME_COOKIE,
  parseAdminTheme,
} from "@/config/admin";
import { getAdminDictionary } from "@/i18n/admin";
import { requireStaff } from "@/server/admin/guard";

/**
 * هيكل اللوحة لجلسة كاملة. الحارس هنا يعطي الهيكل صاحب الجلسة، ولا يغني عن حارس كل صفحة: التخطيط
 * لا يُعاد عرضه عند التنقل، فكل صفحة وكل إجراء يستدعي `requireStaff` بصلاحيته. حالة الشريط الجانبي
 * والمظهر من كوكيَي التفضيل، فيخرج الهيكل بهما من الخادم.
 */
export default async function PanelLayout({ children }: { readonly children: ReactNode }) {
  const context = await requireStaff("account.self");
  const jar = await cookies();
  return (
    <AdminShell
      context={context}
      dictionary={getAdminDictionary()}
      collapsed={jar.get(ADMIN_NAV_COOKIE)?.value === ADMIN_NAV_COLLAPSED}
      theme={parseAdminTheme(jar.get(ADMIN_THEME_COOKIE)?.value)}
    >
      {children}
    </AdminShell>
  );
}
