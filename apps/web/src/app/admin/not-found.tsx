import { Gate } from "@/components/admin/gate";
import { ButtonLink } from "@/components/admin/ui/kit";
import { ADMIN_ROUTES } from "@/config/admin";
import { getAdminDictionary } from "@/i18n/admin";

/** «غير موجودة» داخل اللوحة المفتوحة (واللوحة المغلقة لا تصل إلى هنا: تُخدَّم 404 العامة). */
export default function AdminNotFound() {
  const dictionary = getAdminDictionary();
  const { notFound } = dictionary;
  return (
    <Gate dictionary={dictionary} title={notFound.title} lead={notFound.lead}>
      <ButtonLink href={ADMIN_ROUTES.home} variant="primary" size="large" block>
        {notFound.home}
      </ButtonLink>
    </Gate>
  );
}
