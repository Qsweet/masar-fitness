import { describe, expect, it } from "vitest";
import { hasPermission, PERMISSIONS, permissionsOf, type Permission } from "./permissions";
import { STAFF_ROLES, type StaffRole } from "./roles";

/** جدولا ADMIN_A2_SALES §2 وADMIN_A3_CONTENT §2 خانةً خانة: مالك، مدير، محرر، مبيعات. */
const TABLE: Readonly<Record<Permission, readonly [boolean, boolean, boolean, boolean]>> = {
  "staff.manage": [true, false, false, false],
  "audit.read": [true, true, false, false],
  "overview.read": [true, true, false, true],
  "system.read": [true, true, false, false],
  "account.self": [true, true, true, true],
  "catalog.read": [true, true, false, true],
  "catalog.write": [true, true, false, false],
  "catalog.publish": [true, true, false, false],
  "promotions.read": [true, true, false, true],
  "promotions.write": [true, true, false, false],
  "orders.read": [true, true, false, true],
  "orders.cancel": [true, true, false, true],
  "orders.settle": [true, true, false, false],
  "customers.read": [true, true, false, true],
  "customers.reveal_phone": [true, true, false, true],
  "sales.settings": [true, false, false, false],
  "content.read": [true, true, true, false],
  "content.write": [true, true, true, false],
  "content.facts": [true, true, false, false],
  "content.publish": [true, true, false, false],
};
const COLUMNS: readonly StaffRole[] = ["owner", "manager", "editor", "sales"];

function expected(role: StaffRole): readonly Permission[] {
  const column = COLUMNS.indexOf(role);
  return PERMISSIONS.filter((permission) => TABLE[permission][column] === true);
}

describe("خريطة الصلاحيات", () => {
  it.each(STAFF_ROLES)("الدور %s له صلاحياته المعلنة فقط", (role) => {
    for (const permission of PERMISSIONS) {
      expect(hasPermission(role, permission)).toBe(expected(role).includes(permission));
    }
    expect([...permissionsOf(role)].sort()).toEqual([...expected(role)].sort());
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

  it("الجدول يغطي كل صلاحية معرَّفة وكل دور", () => {
    expect(Object.keys(TABLE).sort()).toEqual([...PERMISSIONS].sort());
    expect([...COLUMNS].sort()).toEqual([...STAFF_ROLES].sort());
  });

  it("الدفع اليدوي للمالك والمدير وحدهما، وإعدادات البيع للمالك وحده", () => {
    const can = (permission: Permission) =>
      STAFF_ROLES.filter((role) => hasPermission(role, permission));
    expect(can("orders.settle")).toEqual(["owner", "manager"]);
    expect(can("sales.settings")).toEqual(["owner"]);
    expect(can("orders.cancel")).toEqual(["owner", "manager", "sales"]);
    expect(can("customers.reveal_phone")).toEqual(["owner", "manager", "sales"]);
  });

  it("المحرر لا يملك شيئًا من المبيعات: حسابه والمحتوى كتابةً وقراءةً فقط", () => {
    expect(permissionsOf("editor")).toEqual(["account.self", "content.read", "content.write"]);
  });

  it("النشر وحقائق النادي للمالك والمدير، والمبيعات لا ترى شيئًا من المحتوى", () => {
    const can = (permission: Permission) =>
      STAFF_ROLES.filter((role) => hasPermission(role, permission));
    expect(can("content.publish")).toEqual(["owner", "manager"]);
    expect(can("content.facts")).toEqual(["owner", "manager"]);
    expect(can("content.write")).toEqual(["owner", "manager", "editor"]);
    expect(
      permissionsOf("sales").filter((permission) => permission.startsWith("content.")),
    ).toEqual([]);
  });

  it("المحرر لا يرى أرقام المبيعات ولا سجل التدقيق", () => {
    expect(hasPermission("editor", "overview.read")).toBe(false);
    expect(hasPermission("editor", "audit.read")).toBe(false);
    expect(hasPermission("sales", "audit.read")).toBe(false);
    expect(hasPermission("sales", "system.read")).toBe(false);
    expect(hasPermission("editor", "system.read")).toBe(false);
  });
});
