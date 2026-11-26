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
import { SelectField } from "./fields";
import { Panel } from "./page-parts";

interface StaffControlsProps {
  readonly member: StaffAccount;
  readonly dictionary: AdminDictionary;
}

function StaffId({ id }: { readonly id: string }) {
  return <input type="hidden" name="staffId" value={id} />;
}

/** أفعال المالك على حساب موظف آخر: الدور، والحالة، وإعادة ضبط الخطوة الثانية وكلمة المرور. */
export function StaffControls({ member, dictionary }: StaffControlsProps) {
  const { staffMember: text, roles, common, errors } = dictionary;
  const labels = (submit: string): AdminFormLabels => ({ submit, pending: common.pending, errors });
  const disabled = member.status === "disabled";
  return (
    <>
      <Panel title={text.roleTitle} lead={text.roleLead}>
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
      </Panel>
      <Panel title={text.mfaTitle} lead={text.mfaLead}>
        <AdminForm action={resetMfaAction} labels={labels(text.mfaSubmit)} variant="outline" inline>
          <StaffId id={member.id} />
        </AdminForm>
      </Panel>
      <Panel title={text.passwordTitle} lead={text.passwordLead}>
        <AdminForm
          action={resetPasswordAction}
          labels={labels(text.passwordSubmit)}
          variant="outline"
          inline
        >
          <StaffId id={member.id} />
        </AdminForm>
      </Panel>
      <Panel title={text.statusTitle} lead={disabled ? text.enableLead : text.disableLead}>
        <AdminForm
          action={setStatusAction}
          labels={labels(disabled ? text.enable : text.disable)}
          variant="outline"
          inline
        >
          <StaffId id={member.id} />
          <input type="hidden" name="status" value={disabled ? "active" : "disabled"} />
        </AdminForm>
      </Panel>
    </>
  );
}
