import { Gate } from "@/components/admin/gate";
import { adminButton } from "@/components/admin/fields";
import { ADMIN_ROUTES } from "@/config/admin";
import { getAdminDictionary } from "@/i18n/admin";

/** «غير موجودة» داخل اللوحة المفتوحة (واللوحة المغلقة لا تصل إلى هنا: الوسيط يخدّم 404 العام). */
export default function AdminNotFound() {
  const dictionary = getAdminDictionary();
  const { notFound } = dictionary;
  return (
    <Gate dictionary={dictionary} title={notFound.title} lead={notFound.lead}>
      <a href={ADMIN_ROUTES.home} className={adminButton("primary", true)}>
        {notFound.home}
      </a>
    </Gate>
  );
}
