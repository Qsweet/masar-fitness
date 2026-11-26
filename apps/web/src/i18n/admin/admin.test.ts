import { PERMISSIONS, ORDER_STATUSES, STAFF_ROLES, STAFF_STATUSES } from "@masar/domain";
import { AUDIT_ACTOR_KINDS, AUDIT_ENTITY_TYPES, STAFF_AUDIT_ACTIONS } from "@masar/db";
import { describe, expect, it } from "vitest";
import { formatDateTime, formatDay } from "./format";
import { ADMIN_LOCALES, adminDirection, getAdminDictionary, lookup } from "./index";

describe("قاموس اللوحة", () => {
  it.each(ADMIN_LOCALES)("%s: كل رمز يكتبه الكود له نص", (locale) => {
    const dictionary = getAdminDictionary(locale);
    expect(Object.keys(dictionary.roles).sort()).toEqual([...STAFF_ROLES].sort());
    expect(Object.keys(dictionary.roleHints).sort()).toEqual([...STAFF_ROLES].sort());
    expect(Object.keys(dictionary.statuses).sort()).toEqual([...STAFF_STATUSES].sort());
    expect(Object.keys(dictionary.audit.actions).sort()).toEqual([...STAFF_AUDIT_ACTIONS].sort());
    expect(Object.keys(dictionary.audit.entities).sort()).toEqual([...AUDIT_ENTITY_TYPES].sort());
    expect(Object.keys(dictionary.audit.actors).sort()).toEqual([...AUDIT_ACTOR_KINDS].sort());
    expect(Object.keys(dictionary.overview.orderStatuses).sort()).toEqual(
      [...ORDER_STATUSES].sort(),
    );
    expect(Object.keys(dictionary.overview.activity.sentences).sort()).toEqual(
      [...STAFF_AUDIT_ACTIONS].sort(),
    );
    expect(PERMISSIONS.length).toBeGreaterThan(0);
  });

  it("العربية من اليمين، وهي الافتراضية", () => {
    expect(adminDirection("ar")).toBe("rtl");
    expect(getAdminDictionary()).toBe(getAdminDictionary("ar"));
  });

  it("رسالة الدخول الفاشل واحدة ولا تذكر سببًا بعينه", () => {
    const text = getAdminDictionary().errors["staff.login_failed"];
    expect(text).not.toMatch(/غير موجود|معطَّل|مقفل الآن/);
  });

  it("lookup يرجع البديل لمفتاح بلا ترجمة، ولا يقرأ خصائص الكائن الموروثة", () => {
    const map = { known: "نص" };
    expect(lookup(map, "known", "بديل")).toBe("نص");
    expect(lookup(map, "missing", "بديل")).toBe("بديل");
    expect(lookup(map, "constructor", "بديل")).toBe("بديل");
    expect(lookup(map, "__proto__", "بديل")).toBe("بديل");
  });
});

describe("تنسيق الوقت في اللوحة", () => {
  const instant = new Date("2026-11-26T21:30:00Z");

  it("بمنطقة النادي الزمنية وأرقام لاتينية وتقويم ميلادي", () => {
    expect(formatDay(instant, "Asia/Riyadh")).toBe("27 نوفمبر 2026");
    expect(formatDay(instant, "UTC")).toBe("26 نوفمبر 2026");
    const text = formatDateTime(instant, "Asia/Riyadh");
    expect(text).toContain("27 نوفمبر 2026");
    expect(text).toContain("12:30");
    expect(text).not.toMatch(/[٠-٩]/);
  });
});
