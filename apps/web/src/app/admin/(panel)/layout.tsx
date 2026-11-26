import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminDictionary } from "@/i18n/admin";
import { requireStaff } from "@/server/admin/guard";

/**
 * هيكل اللوحة لجلسة كاملة. الحارس هنا يعطي الهيكل صاحب الجلسة، ولا يغني عن حارس كل صفحة: التخطيط
 * لا يُعاد عرضه عند التنقل، فكل صفحة وكل إجراء يستدعي `requireStaff` بصلاحيته.
 */
export default async function PanelLayout({ children }: { readonly children: ReactNode }) {
  const context = await requireStaff("account.self");
  return (
    <AdminShell context={context} dictionary={getAdminDictionary()}>
      {children}
    </AdminShell>
  );
}
