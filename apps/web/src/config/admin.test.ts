import { describe, expect, it } from "vitest";
import { ADMIN_ROUTES, isAdminConfigured, isAdminPath, staffMemberPath } from "./admin";

describe("مسارات اللوحة", () => {
  it.each(["/admin", "/admin/", "/admin/login", "/admin/staff/abc"])("«%s» داخل اللوحة", (path) => {
    expect(isAdminPath(path)).toBe(true);
  });

  it.each(["/", "/administrator", "/admins", "/en/admin", "/blog/admin", "/Admin"])(
    "«%s» خارجها",
    (path) => {
      expect(isAdminPath(path)).toBe(false);
    },
  );

  it("كل مسار معرَّف تحت ‎/admin‎", () => {
    expect(Object.values(ADMIN_ROUTES).every(isAdminPath)).toBe(true);
    expect(staffMemberPath("x1")).toBe("/admin/staff/x1");
  });
});

describe("هل اللوحة مضبوطة", () => {
  it("غياب المفتاح أو فراغه = مغلقة", () => {
    expect(isAdminConfigured(undefined)).toBe(false);
    expect(isAdminConfigured("")).toBe(false);
    expect(isAdminConfigured("anything")).toBe(true);
  });
});
