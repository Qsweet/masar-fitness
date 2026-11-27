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
  it("المالك يرى المجموعات الخمس، والمبيعات ثم المحتوى بين «عام» و«الإدارة»", () => {
    expect(labels("owner")).toEqual([
      ["عام", ["نظرة عامة"]],
      [
        "المبيعات",
        ["الطلبات", "العملاء", "الاشتراكات والإضافات", "العروض والكوبونات", "إعدادات البيع"],
      ],
      ["المحتوى", ["النصوص", "شريط الشرائح", "الصور", "النشر والسجل"]],
      ["الإدارة", ["الموظفون", "سجل التدقيق"]],
      ["الحساب", ["حسابي"]],
    ]);
  });

  it("المدير بلا «الموظفون»، والمبيعات بلا مجموعتي المحتوى والإدارة", () => {
    expect(labels("manager")).toEqual([
      ["عام", ["نظرة عامة"]],
      ["المبيعات", ["الطلبات", "العملاء", "الاشتراكات والإضافات", "العروض والكوبونات"]],
      ["المحتوى", ["النصوص", "شريط الشرائح", "الصور", "النشر والسجل"]],
      ["الإدارة", ["سجل التدقيق"]],
      ["الحساب", ["حسابي"]],
    ]);
    expect(labels("sales")).toEqual([
      ["عام", ["نظرة عامة"]],
      ["المبيعات", ["الطلبات", "العملاء", "الاشتراكات والإضافات", "العروض والكوبونات"]],
      ["الحساب", ["حسابي"]],
    ]);
  });

  it("مجموعة المبيعات: إعدادات البيع للمالك وحده، والكتالوج والعروض لمن يقرؤهما", () => {
    const hrefs = (role: (typeof STAFF_ROLES)[number]): string[] =>
      navGroupsFor(role, dictionary)
        .find((group) => group.id === "sales")
        ?.items.map((item) => item.href) ?? [];
    const shared = [
      "/admin/sales/orders",
      "/admin/sales/customers",
      "/admin/sales/plans",
      "/admin/sales/promotions",
    ];
    expect(hrefs("owner")).toEqual([...shared, "/admin/sales/settings"]);
    expect(hrefs("manager")).toEqual(shared);
    expect(hrefs("sales")).toEqual(shared);
    expect(hrefs("editor")).toEqual([]);
  });

  it("المحرر: المحتوى وحسابه، ولا مجموعة فارغة تظهر", () => {
    expect(labels("editor")).toEqual([
      ["المحتوى", ["النصوص", "شريط الشرائح", "الصور", "النشر والسجل"]],
      ["الحساب", ["حسابي"]],
    ]);
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

  it("«النشر والسجل» حالية في مساراتها وحدها، لا في النصوص تحتها", () => {
    expect(isCurrentSection("/admin/content", "/admin/content")).toBe(true);
    expect(isCurrentSection("/admin/content/history/x", "/admin/content")).toBe(true);
    expect(isCurrentSection("/admin/content/publish", "/admin/content")).toBe(true);
    expect(isCurrentSection("/admin/content/texts/hero", "/admin/content")).toBe(false);
    expect(isCurrentSection("/admin/content/texts/hero", "/admin/content/texts")).toBe(true);
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

  it("المعرّف في الرابط يُطابَق بنجمة: تفصيل الطلب وإجراؤه بأسمائهما", () => {
    const id = "018f4e2a-7b1c-7d3e-9f4a-5b6c7d8e9f01";
    const sales = {
      ...known,
      "/admin/sales": "المبيعات",
      "/admin/sales/orders": "الطلبات",
      "/admin/sales/orders/*": "تفصيل الطلب",
      "/admin/sales/orders/*/cancel": "إلغاء الطلب",
    };
    expect(
      breadcrumbTrail(`/admin/sales/orders/${id}/cancel`, sales, "تفصيل").map((c) => c.label),
    ).toEqual(["اللوحة", "المبيعات", "الطلبات", "تفصيل الطلب", "إلغاء الطلب"]);
    expect(breadcrumbTrail(`/admin/sales/orders/${id}`, sales, "تفصيل").at(-1)).toEqual({
      href: `/admin/sales/orders/${id}`,
      label: "تفصيل الطلب",
    });
    // مقطع ليس معرّفًا لا يُطابَق بالنجمة
    expect(breadcrumbTrail("/admin/sales/orders/export", sales, "تفصيل").at(-1)?.label).toBe(
      "تفصيل",
    );
  });

  it("المقطع المجهول (معرّف موظف) يأخذ اسم التفصيل، ولا يُقرأ من خصائص الكائن الموروثة", () => {
    const trail = breadcrumbTrail("/admin/staff/018f4e2a", known, "بيانات موظف");
    expect(trail.at(-1)).toEqual({ href: "/admin/staff/018f4e2a", label: "بيانات موظف" });
    expect(breadcrumbTrail("/constructor", known, "تفصيل")[0]?.label).toBe("تفصيل");
  });
});
