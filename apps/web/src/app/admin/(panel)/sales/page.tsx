import { redirect } from "next/navigation";
import { ADMIN_ROUTES } from "@/config/admin";
import { requireStaff } from "@/server/admin/guard";

/** جذر مجموعة المبيعات (حلقة «المبيعات» في مسار التنقل): يحوّل إلى الطلبات. */
export default async function SalesIndexPage() {
  await requireStaff("orders.read");
  redirect(ADMIN_ROUTES.orders);
}
