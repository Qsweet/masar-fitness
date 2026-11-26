import type { StaffAccount } from "@masar/db";
import { STAFF_ROLES } from "@masar/domain";
import type { AdminDictionary } from "@/i18n/admin";
import {
  changeRoleAction,
  resetMfaAction,
  resetPasswordAction,
  setStatusAction,
} from "@/server/admin/actions/staff";
import { AdminForm, type AdminFormLabels } from "./admin-form";
import { SelectField } from "./ui/fields";
import { Card, CardGrid } from "./ui/kit";

interface StaffControlsProps {
  readonly member: StaffAccount;
  readonly dictionary: AdminDictionary;
}

function StaffId({ id }: { readonly id: string }) {
  return <input type="hidden" name="staffId" value={id} />;
}

/** أفعال المالك على حساب موظف آخر: الدور، وإعادة ضبط الخطوة الثانية وكلمة المرور، والحالة. */
export function StaffControls({ member, dictionary }: StaffControlsProps) {
  const { staffMember: text, roles, errors } = dictionary;
  const labels = (submit: string): AdminFormLabels => ({ submit, errors });
  const disabled = member.status === "disabled";
  return (
    <CardGrid>
      <Card title={text.roleTitle} description={text.roleLead}>
        <AdminForm action={changeRoleAction} labels={labels(text.roleSubmit)} inline>
          <StaffId id={member.id} />
          <SelectField
            id="member-role"
            name="role"
            label={text.roleTitle}
            defaultValue={member.role}
            options={STAFF_ROLES.map((role) => ({ value: role, label: roles[role] }))}
          />
        </AdminForm>
      </Card>
      <Card title={text.mfaTitle} description={text.mfaLead}>
        <AdminForm
          action={resetMfaAction}
          labels={labels(text.mfaSubmit)}
          variant="secondary"
          inline
        >
          <StaffId id={member.id} />
        </AdminForm>
      </Card>
      <Card title={text.passwordTitle} description={text.passwordLead}>
        <AdminForm
          action={resetPasswordAction}
          labels={labels(text.passwordSubmit)}
          variant="secondary"
          inline
        >
          <StaffId id={member.id} />
        </AdminForm>
      </Card>
      <Card title={text.statusTitle} description={disabled ? text.enableLead : text.disableLead}>
        <AdminForm
          action={setStatusAction}
          labels={labels(disabled ? text.enable : text.disable)}
          variant={disabled ? "secondary" : "danger"}
          inline
        >
          <StaffId id={member.id} />
          <input type="hidden" name="status" value={disabled ? "active" : "disabled"} />
        </AdminForm>
      </Card>
    </CardGrid>
  );
}
