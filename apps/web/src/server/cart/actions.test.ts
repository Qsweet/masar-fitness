import { afterEach, describe, expect, it, vi } from "vitest";

const flag = { enabled: true };
const limits = { allowed: true };
const NOT_FOUND = "NEXT_NOT_FOUND";
const REDIRECT = "NEXT_REDIRECT";
vi.mock("../checkout/flag", () => ({
  requireCheckout: () => {
    if (!flag.enabled) {
      throw new Error(NOT_FOUND);
    }
  },
}));
vi.mock("../checkout/throttle", () => ({
  allowCartAction: () => limits.allowed,
  requestIp: () => Promise.resolve("203.0.113.7"),
}));
const redirect = vi.fn((path: string) => {
  throw new Error(`${REDIRECT} ${path}`);
});
vi.mock("next/navigation", () => ({ redirect }));
const saveCart = vi.fn(() => Promise.resolve());
vi.mock("./cookie", () => ({ saveCart }));
vi.mock("../catalog", () => ({
  getMembershipPlan: (slug: string) =>
    Promise.resolve(slug === "six-months" ? { slug } : undefined),
}));

const { addToCart, removeFromCart } = await import("./actions");

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.append(key, value);
  }
  return data;
}

afterEach(() => {
  flag.enabled = true;
  limits.allowed = true;
  saveCart.mockClear();
  redirect.mockClear();
});

describe("إجراءات السلة", () => {
  it("العلم مغلق ⇒ 404 قبل أي كتابة", async () => {
    flag.enabled = false;
    await expect(addToCart(form({ slug: "six-months", locale: "ar" }))).rejects.toThrow(NOT_FOUND);
    expect(saveCart).not.toHaveBeenCalled();
  });

  it("الإضافة ⇒ slug الاشتراك وحده في السلة، ثم صفحة السلة بلغة النموذج وملاحظة «أُضيف»", async () => {
    await expect(addToCart(form({ slug: "six-months", locale: "en" }))).rejects.toThrow(
      `${REDIRECT} /en/cart?note=added`,
    );
    expect(saveCart).toHaveBeenCalledWith({ slug: "six-months" });
  });

  it("اشتراك غير قابل للبيع أو slug مشوّه ⇒ لا يدخل الكوكي، وملاحظة «غير متاح»", async () => {
    for (const slug of ["archived-plan", "Bad Slug"]) {
      await expect(addToCart(form({ slug, locale: "ar" }))).rejects.toThrow(
        `${REDIRECT} /cart?note=unavailable`,
      );
    }
    expect(saveCart).not.toHaveBeenCalled();
  });

  it("تجاوز حد العنوان ⇒ ملاحظة «مشغول» بلا كتابة", async () => {
    limits.allowed = false;
    await expect(addToCart(form({ slug: "six-months", locale: "ar" }))).rejects.toThrow(
      `${REDIRECT} /cart?note=busy`,
    );
    expect(saveCart).not.toHaveBeenCalled();
  });

  it("الحذف ⇒ سلة فارغة وملاحظة «حُذف»", async () => {
    await expect(removeFromCart(form({ slug: "six-months", locale: "ar" }))).rejects.toThrow(
      `${REDIRECT} /cart?note=removed`,
    );
    expect(saveCart).toHaveBeenCalledWith({ slug: null });
  });
});
