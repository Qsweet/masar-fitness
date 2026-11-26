import { describe, expect, it } from "vitest";
import { parseOrderReference } from "./order-reference";

function parse(input: string): string {
  const parsed = parseOrderReference(input);
  return parsed.ok ? parsed.value : parsed.error.reason;
}

describe("parseOrderReference", () => {
  it.each([
    ["MSR-0001234", "MSR-0001234"],
    ["msr-0001234", "MSR-0001234"],
    ["MSR0001234", "MSR-0001234"],
    ["1234", "MSR-0001234"],
    ["0001234", "MSR-0001234"],
    ["  MSR-0000007 ", "MSR-0000007"],
    ["١٢٣٤", "MSR-0001234"],
    ["MSR-12345678", "MSR-12345678"],
    ["‏MSR-0000042‎", "MSR-0000042"],
  ])("%s ← %s", (input, expected) => {
    expect(parse(input)).toBe(expected);
  });

  it.each(["", "MSR-", "abc", "MSR-12a4", "12 34", "ORD-1234", "0", "MSR-0000000", "-5", "1.5"])(
    "يرفض «%s»",
    (input) => {
      expect(parse(input)).toBe("order.reference_invalid");
    },
  );

  it("يرفض رقمًا أطول من أي تسلسل ممكن", () => {
    expect(parse("12345678901")).toBe("order.reference_invalid");
    expect(parse("1234567890")).toBe("MSR-1234567890");
  });
});
