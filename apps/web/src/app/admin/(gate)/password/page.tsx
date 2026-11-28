import type { Metadata } from "next";
import { AdminForm } from "@/components/admin/admin-form";
import { Gate } from "@/components/admin/gate";
import { NewPasswordFields } from "@/components/admin/password-fields";
import { getAdminDictionary } from "@/i18n/admin";
import { changeForcedPasswordAction } from "@/server/admin/actions/password";
import { requireStaff } from "@/server/admin/guard";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().forcedPassword.title };
}

/** تغيير كلمة المرور المؤقتة قبل أي شيء آخر (موظف جديد، أو بعد إعادة ضبط المالك). */
export default async function ForcedPasswordPage() {
  const { staff } = await requireStaff("account.self", "password_change");
  const dictionary = getAdminDictionary();
  const { forcedPassword, errors } = dictionary;
  return (
    <Gate dictionary={dictionary} title={forcedPassword.title} lead={forcedPassword.lead} signedIn>
      <AdminForm
        action={changeForcedPasswordAction}
        labels={{ submit: forcedPassword.submit, errors }}
        block
      >
        <NewPasswordFields idPrefix="forced" email={staff.email} text={dictionary.passwordFields} />
      </AdminForm>
    </Gate>
  );
}
