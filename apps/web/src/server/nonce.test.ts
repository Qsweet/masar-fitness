import { describe, expect, it } from "vitest";
import { buildCsp } from "@/config/csp";
import { nonceFromCsp } from "./nonce";

describe("nonceFromCsp", () => {
  it("يقرأ الـnonce من السياسة التي يبنيها proxy.ts", () => {
    expect(nonceFromCsp(buildCsp("abc123==", false))).toBe("abc123==");
  });

  it("بلا سياسة أو بلا nonce ⇒ غائب", () => {
    expect(nonceFromCsp(null)).toBeUndefined();
    expect(nonceFromCsp("default-src 'self'")).toBeUndefined();
  });
});
