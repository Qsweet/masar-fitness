import type { STAFF_ROLES } from "@masar/domain";
import { describe, expect, it } from "vitest";
import { getAdminDictionary } from "@/i18n/admin";
import {
  actionEntriesFor,
  commandEntriesFor,
  filterCommands,
  normalizeQuery,
  paletteGroups,
  QUICK_ACTIONS,
  rememberRecent,
  RECENT_LIMIT,
} from "./command-model";

const dictionary = getAdminDictionary();
const hrefs = (role: (typeof STAFF_ROLES)[number]) =>
  commandEntriesFor(role, dictionary).map((entry) => entry.href);

describe("مدخلات لوحة الأوامر بصلاحيات الموظف (تُحسب على الخادم)", () => {
  it("المحرر لا يرى الطلبات ولا الموظفين ولا «راجع وانشر»، ويرى المسودة والشرائح", () => {
    const editor = hrefs("editor");
    expect(editor).not.toContain("/admin/sales/orders");
    expect(editor).not.toContain("/admin/staff/new");
    expect(editor).not.toContain("/admin/content/publish");
    expect(editor).toContain("/admin/content/texts");
    expect(editor).toContain("/admin/content/slider/new");
  });

  it("المبيعات يرى الطلبات والبحث عنها، ولا ينشئ اشتراكًا ولا عرضًا ولا يرى المحتوى", () => {
    const sales = hrefs("sales");
    expect(sales).toContain("/admin/sales/orders");
    expect(sales).toContain("/admin/sales/orders?tab=awaiting");
    expect(sales).not.toContain("/admin/sales/plans/new");
    expect(sales).not.toContain("/admin/sales/promotions/new");
    expect(sales.some((href) => href.startsWith("/admin/content"))).toBe(false);
  });

  it("المالك يرى كل الصفحات والإجراءات، والمعاينة تُفتح بتحميل كامل", () => {
    const owner = commandEntriesFor("owner", dictionary);
    expect(owner.filter((entry) => entry.kind === "action")).toHaveLength(8);
    expect(owner.find((entry) => entry.id === "action:previewDraft")?.fullLoad).toBe(true);
    expect(owner.filter((entry) => entry.fullLoad)).toHaveLength(1);
  });

  it("الإجراءات السريعة خمسة للمالك، وما لا يملكه الدور لا يظهر", () => {
    const quick = (role: (typeof STAFF_ROLES)[number]) =>
      actionEntriesFor(role, dictionary, QUICK_ACTIONS).map((entry) => entry.id);
    expect(quick("owner")).toEqual([
      "action:newSlide",
      "action:newPlan",
      "action:newPromotion",
      "action:findOrder",
      "action:newStaff",
    ]);
    expect(quick("manager")).not.toContain("action:newStaff");
    expect(quick("sales")).toEqual(["action:findOrder"]);
  });
});

describe("الترشيح النصي", () => {
  const entries = commandEntriesFor("owner", dictionary);

  it("يوحّد التشكيل والتطويل وصور الألف والتاء المربوطة", () => {
    expect(normalizeQuery("  الإضـافاتُ  ")).toBe("الاضافات");
    expect(normalizeQuery("نظرة")).toBe("نظره");
    expect(normalizeQuery("Orders")).toBe("orders");
  });

  it("بالعربية والإنجليزية، وبداية الاسم أولًا", () => {
    expect(filterCommands(entries, "الطلبات")[0]?.href).toBe("/admin/sales/orders");
    expect(filterCommands(entries, "orders")[0]?.href).toBe("/admin/sales/orders");
    expect(filterCommands(entries, "coupon").map((entry) => entry.id)).toContain(
      "action:newPromotion",
    );
    expect(filterCommands(entries, "لا يطابق شيئًا أبدًا")).toEqual([]);
  });

  it("كل كلمة يجب أن تطابق، والنطاق يحصر النوع", () => {
    expect(filterCommands(entries, "اضف موظف").map((entry) => entry.id)).toEqual([
      "action:newStaff",
    ]);
    const pages = filterCommands(entries, "", "page");
    expect(pages.every((entry) => entry.kind === "page")).toBe(true);
    expect(filterCommands(entries, "", "action").every((entry) => entry.kind === "action")).toBe(
      true,
    );
  });
});

describe("مجموعات اللوحة و«الأخيرة»", () => {
  const entries = commandEntriesFor("owner", dictionary);

  it("البحث الفارغ: الأخيرة أولًا بلا تكرار تحتها، ثم الصفحات ثم الإجراءات", () => {
    const groups = paletteGroups(entries, "", "all", ["/admin/audit", "/admin/unknown"]);
    expect(groups.map((group) => group.kind)).toEqual(["recent", "page", "action"]);
    expect(groups[0]?.entries.map((entry) => entry.href)).toEqual(["/admin/audit"]);
    expect(groups[1]?.entries.some((entry) => entry.href === "/admin/audit")).toBe(false);
  });

  it("مع عبارة أو نطاق لا تظهر الأخيرة، والمجموعة الفارغة لا تظهر", () => {
    expect(paletteGroups(entries, "سجل", "all", ["/admin/audit"]).map((g) => g.kind)).toEqual([
      "page",
    ]);
    expect(paletteGroups(entries, "", "action", ["/admin/audit"]).map((g) => g.kind)).toEqual([
      "action",
    ]);
  });

  it("الأخيرة: الرابط إلى الرأس بلا تكرار وبحد", () => {
    const many = Array.from({ length: 9 }, (_, index) => `/admin/${String(index)}`);
    const next = rememberRecent(many, "/admin/3");
    expect(next[0]).toBe("/admin/3");
    expect(next).toHaveLength(RECENT_LIMIT);
    expect(new Set(next).size).toBe(next.length);
  });
});
