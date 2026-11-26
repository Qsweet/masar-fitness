/** أدوار الموظفين وحالاتهم. القاعدة تحمل القيم نفسها (staff_role، staff_status). */
export const STAFF_ROLES = ["owner", "manager", "editor", "sales"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const STAFF_STATUSES = ["active", "disabled"] as const;
export type StaffStatus = (typeof STAFF_STATUSES)[number];

export function isStaffRole(value: unknown): value is StaffRole {
  return STAFF_ROLES.some((role) => role === value);
}

export function isStaffStatus(value: unknown): value is StaffStatus {
  return STAFF_STATUSES.some((status) => status === value);
}
