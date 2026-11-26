import { ButtonLink, PageHeader } from "@/components/admin/ui/kit";
import { ADMIN_ROUTES } from "@/config/admin";
import { getAdminDictionary } from "@/i18n/admin";

/** رابط مجهول أو صفحة بلا صلاحية داخل اللوحة: الرد نفسه في الحالتين. */
export default function PanelNotFound() {
  const { notFound } = getAdminDictionary();
  return (
    <PageHeader title={notFound.title} description={notFound.lead}>
      <ButtonLink href={ADMIN_ROUTES.account} variant="primary">
        {notFound.home}
      </ButtonLink>
    </PageHeader>
  );
}
