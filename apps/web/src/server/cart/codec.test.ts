import { describe, expect, it } from "vitest";
import { cartCount, decodeCart, EMPTY_CART, encodeCart } from "./codec";

describe("ترميز السلة في الكوكي", () => {
  it("يحفظ slug الاشتراك فقط ويقرؤه كما هو", () => {
    const encoded = encodeCart({ slug: "six-months" });
    expect(encoded).toBe("v1.six-months");
    expect(decodeCart(encoded)).toEqual({ slug: "six-months" });
    expect(cartCount(decodeCart(encoded))).toBe(1);
  });

  it("السلة الفارغة نص فارغ، وعددها صفر", () => {
    expect(encodeCart(EMPTY_CART)).toBe("");
    expect(cartCount(EMPTY_CART)).toBe(0);
  });

  it("كوكي غائب أو تالف أو بصيغة أخرى أو slug بشكل غريب ⇒ سلة فارغة بلا خطأ", () => {
    for (const raw of [
      undefined,
      "",
      "six-months",
      "v2.six-months",
      "v1.",
      "v1.Six Months",
      "v1.a--b",
    ]) {
      expect(decodeCart(raw), String(raw)).toEqual(EMPTY_CART);
    }
    expect(decodeCart(`v1.${"a".repeat(81)}`)).toEqual(EMPTY_CART);
  });
});
