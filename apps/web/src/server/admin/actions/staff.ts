"use server";

import { isStaffRole, isStaffStatus } from "@masar/domain";
import { redirect } from "next/navigation";
import {
  ADMIN_ROUTES,
  MAX_EMAIL_INPUT_LENGTH,
  MAX_NAME_INPUT_LENGTH,
  staffMemberPath,
} from "@/config/admin";
import { clearFlash, writeFlash } from "../flash";
import { failed, idField, textField, type AdminFormState } from "../form";
import { requireStaff } from "../guard";
import {
  changeStaffMember,
  createStaffMember,
  resetStaffMfa,
  resetStaffPassword,
} from "../staff-admin";

const ROLE_INPUT_LENGTH = 16;
const INVALID = "staff.invalid_request";

function done(staffId: string, notice: string): never {
  redirect(`${staffMemberPath(staffId)}?done=${notice}`);
}

/** إنشاء موظف بكلمة مرور مؤقتة تُعرض للمالك مرة في صفحة الموظف. */
export async function createStaffAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const context = await requireStaff("staff.manage");
  const role = textField(formData, "role", ROLE_INPUT_LENGTH);
  if (!isStaffRole(role)) {
    return failed(INVALID);
  }
  const created = await createStaffMember(
    context,
    {
      email: textField(formData, "email", MAX_EMAIL_INPUT_LENGTH),
      displayName: textField(formData, "displayName", MAX_NAME_INPUT_LENGTH),
      role,
    },
    new Date(),
  );
  if (!created.ok) {
    return failed(created.error.reason);
  }
  const { staff, temporaryPassword } = created.value;
  await writeFlash(context.staff.id, {
    kind: "temporary_password",
    subject: staff.id,
    values: [temporaryPassword],
  });
  done(staff.id, "staff_created");
}

export async function changeRoleAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const context = await requireStaff("staff.manage");
  const staffId = idField(formData, "staffId");
  const role = textField(formData, "role", ROLE_INPUT_LENGTH);
  if (staffId === null || !isStaffRole(role)) {
    return failed(INVALID);
  }
  const changed = await changeStaffMember(context, staffId, { role }, new Date());
  if (!changed.ok) {
    return failed(changed.error.reason);
  }
  done(staffId, "role_changed");
}

/** تعطيل الحساب أو إعادة تفعيله. التعطيل يلغي جلسات الموظف فورًا. */
export async function setStatusAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const context = await requireStaff("staff.manage");
  const staffId = idField(formData, "staffId");
  const status = textField(formData, "status", ROLE_INPUT_LENGTH);
  if (staffId === null || !isStaffStatus(status)) {
    return failed(INVALID);
  }
  const changed = await changeStaffMember(context, staffId, { status }, new Date());
  if (!changed.ok) {
    return failed(changed.error.reason);
  }
  done(staffId, status === "disabled" ? "staff_disabled" : "staff_enabled");
}

export async function resetMfaAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const context = await requireStaff("staff.manage");
  const staffId = idField(formData, "staffId");
  if (staffId === null) {
    return failed(INVALID);
  }
  const reset = await resetStaffMfa(context, staffId, new Date());
  if (!reset.ok) {
    return failed(reset.error.reason);
  }
  done(staffId, "mfa_reset");
}

/** كلمة مرور مؤقتة جديدة تُعرض للمالك مرة في صفحة الموظف. */
export async function resetPasswordAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const context = await requireStaff("staff.manage");
  const staffId = idField(formData, "staffId");
  if (staffId === null) {
    return failed(INVALID);
  }
  const reset = await resetStaffPassword(context, staffId, new Date());
  if (!reset.ok) {
    return failed(reset.error.reason);
  }
  await writeFlash(context.staff.id, {
    kind: "temporary_password",
    subject: staffId,
    values: [reset.value],
  });
  done(staffId, "password_reset");
}

/** المالك نسخ الكلمة المؤقتة: تُمحى من المتصفح. */
export async function dismissTemporaryPasswordAction(formData: FormData): Promise<void> {
  await requireStaff("staff.manage");
  const staffId = idField(formData, "staffId");
  await clearFlash();
  redirect(staffId === null ? ADMIN_ROUTES.staff : staffMemberPath(staffId));
}
