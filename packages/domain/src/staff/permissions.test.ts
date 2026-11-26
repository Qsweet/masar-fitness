import { describe, expect, it } from "vitest";
import { hasPermission, PERMISSIONS, permissionsOf, type Permission } from "./permissions";
import { STAFF_ROLES, type StaffRole } from "./roles";

const EXPECTED: Record<StaffRole, readonly Permission[]> = {
  owner: ["staff.manage", "audit.read", "overview.read", "account.self"],
  manager: ["audit.read", "overview.read", "account.self"],
  editor: ["account.self"],
  sales: ["overview.read", "account.self"],
};

describe("خريطة الصلاحيات", () => {
  it.each(STAFF_ROLES)("الدور %s له صلاحياته المعلنة فقط", (role) => {
    for (const permission of PERMISSIONS) {
      expect(hasPermission(role, permission)).toBe(EXPECTED[role].includes(permission));
    }
    expect([...permissionsOf(role)].sort()).toEqual([...EXPECTED[role]].sort());
  });

  it("المالك وحده يدير الموظفين", () => {
    const managers = STAFF_ROLES.filter((role) => hasPermission(role, "staff.manage"));
    expect(managers).toEqual(["owner"]);
  });

  it("المالك يملك كل صلاحية معرَّفة", () => {
    expect(PERMISSIONS.every((permission) => hasPermission("owner", permission))).toBe(true);
  });

  it("كل دور يصل إلى حسابه", () => {
    expect(STAFF_ROLES.every((role) => hasPermission(role, "account.self"))).toBe(true);
  });

  it("المحرر لا يرى أرقام المبيعات ولا سجل التدقيق", () => {
    expect(hasPermission("editor", "overview.read")).toBe(false);
    expect(hasPermission("editor", "audit.read")).toBe(false);
    expect(hasPermission("sales", "audit.read")).toBe(false);
  });
});
