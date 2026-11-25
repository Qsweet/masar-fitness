import { describe, expect, it } from "vitest";
import { validateAssessmentRequest } from "./assessment";

function reasonOf(product: { kind: string; status: string } | undefined): string | null {
  const result = validateAssessmentRequest({ product });
  return result.ok ? null : `${result.error.code}: ${result.error.reason}`;
}

const UNAVAILABLE = "not_found: assessment.product_unavailable";

describe("validateAssessmentRequest", () => {
  it("الخدمة بتقييم الفعّالة مقبولة", () => {
    expect(
      validateAssessmentRequest({ product: { kind: "assessed_service", status: "active" } }),
    ).toEqual({ ok: true, value: true });
  });

  it("المنتج غير الموجود غير متاح", () => {
    expect(reasonOf(undefined)).toBe(UNAVAILABLE);
  });

  it("الخدمة بتقييم غير الفعّالة غير متاحة", () => {
    expect(reasonOf({ kind: "assessed_service", status: "draft" })).toBe(UNAVAILABLE);
    expect(reasonOf({ kind: "assessed_service", status: "archived" })).toBe(UNAVAILABLE);
  });

  it("الاشتراك والبرنامج والإضافة لا تُطلب بتقييم", () => {
    for (const kind of ["membership", "digital_program", "addon"]) {
      expect(reasonOf({ kind, status: "active" })).toBe(UNAVAILABLE);
    }
  });
});
