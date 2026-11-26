import { STAFF_ROLES } from "@masar/domain";
import { describe, expect, it } from "vitest";
import { getAdminDictionary } from "@/i18n/admin";
import { breadcrumbTrail, isCurrentSection, navGroupsFor } from "./nav-model";

const dictionary = getAdminDictionary();

function labels(role: (typeof STAFF_ROLES)[number]): [string, string[]][] {
  return navGroupsFor(role, dictionary).map((group) => [
    group.label,
    group.items.map((item) => item.label),
  ]);
}

describe("مجموعات التنقل بحسب الدور", () => {
  it("المالك يرى المجموعات الثلاث", () => {
    expect(labels("owner")).toEqual([
      ["عام", ["نظرة عامة"]],
      ["الإدارة", ["الموظفون", "سجل التدقيق"]],
      ["الحساب", ["حسابي"]],
    ]);
  });

  it("المدير بلا «الموظفون»، والمبيعات بلا مجموعة الإدارة كلها", () => {
    expect(labels("manager")).toEqual([
      ["عام", ["نظرة عامة"]],
      ["الإدارة", ["سجل التدقيق"]],
      ["الحساب", ["حسابي"]],
    ]);
    expect(labels("sales")).toEqual([
      ["عام", ["نظرة عامة"]],
      ["الحساب", ["حسابي"]],
    ]);
  });

  it("المحرر: حسابه فقط، ولا مجموعة فارغة تظهر", () => {
    expect(labels("editor")).toEqual([["الحساب", ["حسابي"]]]);
    for (const role of STAFF_ROLES) {
      expect(navGroupsFor(role, dictionary).every((group) => group.items.length > 0)).toBe(true);
    }
  });
});

describe("القسم الحالي", () => {
  it("الرئيسية بمطابقة تامة، وغيرها ببادئة المسار", () => {
    expect(isCurrentSection("/admin", "/admin")).toBe(true);
    expect(isCurrentSection("/admin/staff", "/admin")).toBe(false);
    expect(isCurrentSection("/admin/staff/new", "/admin/staff")).toBe(true);
    expect(isCurrentSection("/admin/staffing", "/admin/staff")).toBe(false);
  });
});

describe("مسار التنقل", () => {
  const known = {
    "/admin": "اللوحة",
    "/admin/staff": "الموظفون",
    "/admin/staff/new": "أضف موظفًا",
  };

  it("كل مقطع معروف حلقة باسمه", () => {
    expect(breadcrumbTrail("/admin/staff/new", known, "بيانات موظف")).toEqual([
      { href: "/admin", label: "اللوحة" },
      { href: "/admin/staff", label: "الموظفون" },
      { href: "/admin/staff/new", label: "أضف موظفًا" },
    ]);
    expect(breadcrumbTrail("/admin", known, "بيانات موظف")).toEqual([
      { href: "/admin", label: "اللوحة" },
    ]);
  });

  it("المقطع المجهول (معرّف موظف) يأخذ اسم التفصيل، ولا يُقرأ من خصائص الكائن الموروثة", () => {
    const trail = breadcrumbTrail("/admin/staff/018f4e2a", known, "بيانات موظف");
    expect(trail.at(-1)).toEqual({ href: "/admin/staff/018f4e2a", label: "بيانات موظف" });
    expect(breadcrumbTrail("/constructor", known, "تفصيل")[0]?.label).toBe("تفصيل");
  });
});
