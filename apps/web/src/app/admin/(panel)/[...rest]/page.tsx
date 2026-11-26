import { notFound } from "next/navigation";
import { requireStaff } from "@/server/admin/guard";

/** أي مسار غير معرَّف تحت اللوحة: الحارس أولًا (بلا جلسة ⇒ الدخول)، ثم «غير موجودة» داخل الهيكل. */
export default async function UnknownAdminPath(): Promise<never> {
  await requireStaff("account.self");
  notFound();
}
