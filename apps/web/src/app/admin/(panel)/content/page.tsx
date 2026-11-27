import { redirect } from "next/navigation";
import { ADMIN_ROUTES } from "@/config/admin";
import { requireStaff } from "@/server/admin/guard";

/** جذر مجموعة المحتوى (حلقة «المحتوى» في مسار التنقل): يحوّل إلى النصوص. */
export default async function ContentIndexPage() {
  await requireStaff("content.read");
  redirect(ADMIN_ROUTES.contentTexts);
}
