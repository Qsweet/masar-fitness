import Link from "next/link";
import { adminButton } from "@/components/admin/fields";
import { PageHeader } from "@/components/admin/page-parts";
import { ADMIN_ROUTES } from "@/config/admin";
import { getAdminDictionary } from "@/i18n/admin";

/** رابط مجهول أو صفحة بلا صلاحية داخل اللوحة: الرد نفسه في الحالتين. */
export default function PanelNotFound() {
  const { notFound } = getAdminDictionary();
  return (
    <>
      <PageHeader title={notFound.title} lead={notFound.lead} />
      <div>
        <Link href={ADMIN_ROUTES.account} prefetch={false} className={adminButton("primary")}>
          {notFound.home}
        </Link>
      </div>
    </>
  );
}
