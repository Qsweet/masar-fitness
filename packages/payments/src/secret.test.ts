import { describe, expect, it } from "vitest";
import { secretsEqual } from "./secret";

describe("secretsEqual", () => {
  it("يطابق السر نفسه فقط", () => {
    expect(secretsEqual("a-shared-secret", "a-shared-secret")).toBe(true);
  });

  it.each([
    ["أطول", "a-shared-secretx"],
    ["أقصر", "a-shared-secre"],
    ["فارغ", ""],
    ["حالة أحرف مختلفة", "A-shared-secret"],
    ["محرف يونيكود مشابه", "a‐shared‐secret"],
  ])("لا يطابق ولا يرمي: %s", (_name, received) => {
    expect(secretsEqual(received, "a-shared-secret")).toBe(false);
  });
});
