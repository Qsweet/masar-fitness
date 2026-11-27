import { describe, expect, it } from "vitest";
import { TEXT_LIMITS, textKindOf, textLength } from "./limits";

describe("أنواع النصوص وأطوالها", () => {
  it("الطول بنقاط الترميز بعد التطبيع", () => {
    expect(textLength("مرحبًا")).toBe(6);
    expect(textLength("é")).toBe(1);
    expect(textLength("😀")).toBe(1);
  });

  it("العنوان والوصف لمحركات البحث باسم المفتاح", () => {
    expect(textKindOf("meta.homeTitle", ["قصير"])).toBe("metaTitle");
    expect(textKindOf("meta.planDescription", ["قصير"])).toBe("metaDescription");
    expect(textKindOf("tools.costPerVisit.metaTitle", ["قصير"])).toBe("metaTitle");
    expect(textKindOf("hero.title", ["قصير"])).toBe("label");
  });

  it("ما سواهما بطول الأطول من الافتراضيين، ويبقى للمحرر ضعفه على الأقل", () => {
    expect(textKindOf("a.b", ["x".repeat(20), "y"])).toBe("label");
    expect(textKindOf("a.b", ["x", "y".repeat(21)])).toBe("short");
    expect(textKindOf("a.b", ["x".repeat(100)])).toBe("line");
    expect(textKindOf("a.b", ["x".repeat(121)])).toBe("paragraph");
    for (const length of [1, 20, 21, 45, 46, 120, 121, 350]) {
      const kind = textKindOf("a.b", ["x".repeat(length)]);
      expect(TEXT_LIMITS[kind]).toBeGreaterThanOrEqual(length * 2);
    }
  });
});
