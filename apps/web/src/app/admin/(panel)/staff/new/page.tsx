import { STAFF_ROLES } from "@masar/domain";
import type { Metadata } from "next";
import { AdminForm } from "@/components/admin/admin-form";
import { SelectField, TextField } from "@/components/admin/ui/fields";
import { Card, PageHeader } from "@/components/admin/ui/kit";
import { MAX_EMAIL_INPUT_LENGTH, MAX_NAME_INPUT_LENGTH } from "@/config/admin";
import { getAdminDictionary } from "@/i18n/admin";
import { createStaffAction } from "@/server/admin/actions/staff";
import { requireStaff } from "@/server/admin/guard";

const DEFAULT_ROLE = "sales";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().staffNew.title };
}

/** إنشاء حساب موظف بكلمة مرور مؤقتة تُعرض للمالك مرة في صفحة الموظف. */
export default async function NewStaffPage() {
  await requireStaff("staff.manage");
  const { staffNew, staffMember, roles, roleHints, errors } = getAdminDictionary();
  const options = STAFF_ROLES.map((role) => ({
    value: role,
    label: `${roles[role]}: ${roleHints[role]}`,
  }));
  return (
    <>
      <PageHeader title={staffNew.title} description={staffNew.lead} />
      <Card title={staffMember.details} narrow>
        <AdminForm action={createStaffAction} labels={{ submit: staffNew.submit, errors }}>
          <TextField
            id="staff-name"
            name="displayName"
            label={staffNew.name}
            hint={staffNew.nameHint}
            autoComplete="off"
            maxLength={MAX_NAME_INPUT_LENGTH}
            required
          />
          <TextField
            id="staff-email"
            name="email"
            type="email"
            label={staffNew.email}
            autoComplete="off"
            inputMode="email"
            dir="ltr"
            maxLength={MAX_EMAIL_INPUT_LENGTH}
            required
          />
          <SelectField
            id="staff-role"
            name="role"
            label={staffNew.role}
            defaultValue={DEFAULT_ROLE}
            options={options}
          />
        </AdminForm>
      </Card>
    </>
  );
}
