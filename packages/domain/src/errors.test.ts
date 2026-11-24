import { describe, expect, it } from "vitest";
import { DomainError } from "./errors";

describe("DomainError", () => {
  it("يحمل الصنف والسبب والحقل", () => {
    const error = new DomainError("validation", "mobile.not_saudi_mobile", { field: "mobile" });
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("validation");
    expect(error.reason).toBe("mobile.not_saudi_mobile");
    expect(error.field).toBe("mobile");
  });

  it("يحفظ السبب الأصلي للتشخيص", () => {
    const cause = new Error("db down");
    expect(new DomainError("invariant", "x", { cause }).cause).toBe(cause);
    expect(new DomainError("invariant", "x").cause).toBeUndefined();
  });
});
