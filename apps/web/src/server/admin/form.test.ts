import { describe, expect, it } from "vitest";
import { EMPTY_FORM_STATE, failed, idField, isUuid, textField } from "./form";

function form(fields: Record<string, string | Blob>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.append(key, value);
  }
  return data;
}

const ID = "018f4e2a-1b2c-7d3e-8f40-0123456789ab";

describe("حقول نماذج اللوحة", () => {
  it("الحقل النصي كما هو، والغائب والملف فارغان", () => {
    const data = form({ email: " a@b.sa ", file: new Blob(["x"]) });
    expect(textField(data, "email", 20)).toBe(" a@b.sa ");
    expect(textField(data, "missing", 20)).toBe("");
    expect(textField(data, "file", 20)).toBe("");
  });

  it("الأطول من الحد يُعامل كفارغ لا مقصوصًا", () => {
    expect(textField(form({ password: "x".repeat(21) }), "password", 20)).toBe("");
    expect(textField(form({ password: "x".repeat(20) }), "password", 20)).toHaveLength(20);
  });

  it("المعرّف UUID فقط", () => {
    expect(idField(form({ staffId: ID }), "staffId")).toBe(ID);
    expect(idField(form({ staffId: `${ID}'; DROP` }), "staffId")).toBeNull();
    expect(idField(form({ staffId: "not-an-id" }), "staffId")).toBeNull();
    expect(idField(form({}), "staffId")).toBeNull();
    expect(isUuid(ID)).toBe(true);
    expect(isUuid(ID.toUpperCase())).toBe(false);
  });

  it("حالة النموذج", () => {
    expect(EMPTY_FORM_STATE).toEqual({ error: null });
    expect(failed("staff.login_failed")).toEqual({ error: "staff.login_failed" });
  });
});
