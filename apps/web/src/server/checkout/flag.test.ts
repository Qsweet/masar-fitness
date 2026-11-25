import { afterEach, describe, expect, it, vi } from "vitest";

const env = { CHECKOUT_ENABLED: false };
vi.mock("../env", () => ({ getEnv: () => env }));

// notFound الحقيقية ترمي خطأً خاصًا يلتقطه Next؛ نحاكيها برمي يمكن تمييزه
const NOT_FOUND = "NEXT_NOT_FOUND";
const notFound = vi.fn(() => {
  throw new Error(NOT_FOUND);
});
vi.mock("next/navigation", () => ({ notFound }));

const { isCheckoutEnabled, requireCheckout } = await import("./flag");

afterEach(() => {
  notFound.mockClear();
  env.CHECKOUT_ENABLED = false;
});

describe("علم الشراء الإلكتروني", () => {
  it("مغلقًا: isCheckoutEnabled خطأ، و requireCheckout ترجع 404", () => {
    expect(isCheckoutEnabled()).toBe(false);
    expect(() => {
      requireCheckout();
    }).toThrow(NOT_FOUND);
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("مفتوحًا: requireCheckout تمر بلا 404", () => {
    env.CHECKOUT_ENABLED = true;
    expect(isCheckoutEnabled()).toBe(true);
    expect(() => {
      requireCheckout();
    }).not.toThrow();
    expect(notFound).not.toHaveBeenCalled();
  });
});
