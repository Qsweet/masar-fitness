import { describe, expect, it } from "vitest";
import { isStaffRole, isStaffStatus } from "./roles";
import {
  assertOwnerRemains,
  clubPasswordWords,
  parseStaffEmail,
  parseStaffName,
  removesLastOwner,
  STAFF_NAME_MAX_LENGTH,
} from "./staff-rules";

const OWNER = { role: "owner", status: "active" } as const;

describe("بريد الموظف واسمه", () => {
  it("يوحّد البريد إلى حروف صغيرة بلا مسافات", () => {
    const result = parseStaffEmail("  Owner@Example.SA ");
    expect(result.ok && result.value).toBe("owner@example.sa");
  });

  it.each(["", "no-at.example.sa", "a@b", "a b@example.sa", `${"x".repeat(250)}@a.sa`])(
    "يرفض «%s»",
    (raw) => {
      const result = parseStaffEmail(raw);
      expect(!result.ok && result.error.reason).toBe("staff.email_invalid");
    },
  );

  it("يقصّ الاسم ويوحّد مسافاته", () => {
    const result = parseStaffName("  خالد   العتيبي ");
    expect(result.ok && result.value).toBe("خالد العتيبي");
  });

  it("يرفض اسمًا أقصر من حرفين أو أطول من الحد", () => {
    expect(parseStaffName(" خ ").ok).toBe(false);
    expect(parseStaffName("خ".repeat(STAFF_NAME_MAX_LENGTH + 1)).ok).toBe(false);
    expect(parseStaffName("خ".repeat(STAFF_NAME_MAX_LENGTH)).ok).toBe(true);
  });
});

describe("بقاء مالك نشط", () => {
  it("تعطيل المالك الوحيد أو تنزيله مرفوض", () => {
    expect(removesLastOwner(OWNER, { role: "owner", status: "disabled" }, 1)).toBe(true);
    expect(removesLastOwner(OWNER, { role: "manager", status: "active" }, 1)).toBe(true);
    const result = assertOwnerRemains(OWNER, { role: "manager", status: "active" }, 1);
    expect(!result.ok && result.error.reason).toBe("staff.last_owner");
  });

  it("مع مالك نشط آخر يُقبل", () => {
    expect(removesLastOwner(OWNER, { role: "manager", status: "active" }, 2)).toBe(false);
    expect(assertOwnerRemains(OWNER, { role: "owner", status: "disabled" }, 2).ok).toBe(true);
  });

  it("تغيير غير المالك لا يمسّه العدد", () => {
    const manager = { role: "manager", status: "active" } as const;
    expect(removesLastOwner(manager, { role: "sales", status: "disabled" }, 1)).toBe(false);
    expect(removesLastOwner({ role: "owner", status: "disabled" }, OWNER, 0)).toBe(false);
  });
});

describe("حراس الأنواع", () => {
  it("الأدوار والحالات المعروفة فقط", () => {
    expect(isStaffRole("owner")).toBe(true);
    expect(isStaffRole("admin")).toBe(false);
    expect(isStaffStatus("disabled")).toBe(true);
    expect(isStaffStatus(null)).toBe(false);
  });
});

describe("كلمات اسم النادي الممنوعة في كلمة المرور", () => {
  it("الأسماء كاملة وكلماتها بلا تكرار", () => {
    const words = clubPasswordWords({
      slug: "masar-al-abtal",
      nameAr: "مسار الأبطال",
      nameEn: "Masters Way",
    });
    expect(words).toEqual([
      "مسار الأبطال",
      "Masters Way",
      "masar al abtal",
      "مسار",
      "الأبطال",
      "Masters",
      "Way",
      "masar",
      "al",
      "abtal",
    ]);
  });
});
