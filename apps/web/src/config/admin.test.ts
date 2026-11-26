import { describe, expect, it } from "vitest";
import {
  ADMIN_ROUTES,
  ADMIN_SEGMENT_PATTERN,
  isAdminConfigured,
  isAdminPath,
  staffMemberPath,
} from "./admin";

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

describe("نمط اسم اللوحة في قاعدة إعادة الكتابة", () => {
  // القواعد تُطابَق بلا حساسية حروف، كما في next.config
  const pattern = new RegExp(`^${ADMIN_SEGMENT_PATTERN}$`, "i");

  it.each(["admin", "Admin", "ADMIN", "%61dmin", "%41DMIN", "a%64%4Din", "%61%64%6d%69%6e"])(
    "«%s» كتابة لاسم اللوحة",
    (segment) => {
      expect(pattern.test(segment)).toBe(true);
      expect(decodeURIComponent(segment).toLowerCase()).toBe("admin");
    },
  );

  it.each(["admins", "administrator", "%62dmin", "adm", "%2561dmin", "admin%2f"])(
    "«%s» ليس اسم اللوحة",
    (segment) => {
      expect(pattern.test(segment)).toBe(false);
    },
  );
});

describe("هل اللوحة مضبوطة", () => {
  it("غياب المفتاح أو فراغه = مغلقة", () => {
    expect(isAdminConfigured(undefined)).toBe(false);
    expect(isAdminConfigured("")).toBe(false);
    expect(isAdminConfigured("anything")).toBe(true);
  });
});
