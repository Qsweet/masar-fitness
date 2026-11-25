import { describe, expect, it } from "vitest";
import { DomainError } from "../../errors";
import type { Money } from "../../money";
import { validateCart, type CartInput, type CartLine } from "./cart";
import { cartLine } from "./test-support";

const PLAN = cartLine("membership", "plan", 99900, { paidMonths: 12 });

function addon(id: string, sortOrder = 0): CartLine {
  return cartLine("addon", id, 15000, { sortOrder });
}

function reasonOf(input: CartInput): string | null {
  const result = validateCart(input);
  if (result.ok) {
    return null;
  }
  expect(result.error.code).toBe("validation");
  return result.error.reason;
}

function cart(addons: readonly CartLine[], attachable = addons.map((a) => a.productId)): CartInput {
  return { primary: PLAN, addons, attachableAddonProductIds: attachable };
}

describe("validateCart", () => {
  it("باقة وحدها صالحة", () => {
    expect(validateCart(cart([]))).toEqual({ ok: true, value: [PLAN] });
  });

  it("برنامج رقمي وحده صالح ولو بلا مدة", () => {
    const program = cartLine("digital_program", "program", 9900);
    const result = validateCart({ primary: program, addons: [], attachableAddonProductIds: [] });
    expect(result.ok).toBe(true);
  });

  it("الإضافة لا تكون سطرًا أساسيًا", () => {
    const input = { primary: addon("pt"), addons: [], attachableAddonProductIds: [] };
    expect(reasonOf(input)).toBe("cart.addon_requires_membership");
  });

  it("الإضافة مع برنامج رقمي مرفوضة", () => {
    const program = cartLine("digital_program", "program", 9900);
    const input = { primary: program, addons: [addon("pt")], attachableAddonProductIds: ["pt"] };
    expect(reasonOf(input)).toBe("cart.addon_requires_membership");
  });

  it("إضافة غير مرتبطة بالباقة مرفوضة", () => {
    expect(reasonOf(cart([addon("pt")], []))).toBe("cart.addon_not_attachable");
    expect(reasonOf(cart([addon("pt"), addon("locker")], ["pt"]))).toBe(
      "cart.addon_not_attachable",
    );
  });

  it("إضافة مكررة مرفوضة", () => {
    expect(reasonOf(cart([addon("pt"), addon("pt")]))).toBe("cart.addon_duplicate");
  });

  it("خمس إضافات مقبولة، وست مرفوضة", () => {
    const five = ["a1", "a2", "a3", "a4", "a5"].map((id) => addon(id));
    expect(reasonOf(cart(five))).toBeNull();
    expect(reasonOf(cart([...five, addon("a6")]))).toBe("cart.too_many_addons");
  });

  it("يرتب الإضافات بـsortOrder ثم slug بعد الأساسي", () => {
    const input = cart([addon("zeta", 1), addon("beta", 2), addon("alpha", 1)]);
    const result = validateCart(input);
    expect(result.ok && result.value.map((line) => line.slug)).toEqual([
      "plan",
      "alpha",
      "zeta",
      "beta",
    ]);
  });

  it("سطر من نوع آخر في قائمة الإضافات عطل (invariant)", () => {
    const wrong = cartLine("membership", "other", 100, { paidMonths: 1 });
    expect(() => validateCart(cart([wrong]))).toThrow(/cart.addon_line_kind_mismatch/);
  });

  it("باقة اشتراك بلا أشهر مدفوعة عطل (invariant)", () => {
    const broken = { ...PLAN, paidMonths: null };
    expect(() =>
      validateCart({ primary: broken, addons: [], attachableAddonProductIds: [] }),
    ).toThrow(DomainError);
  });

  it("اختلاف العملة بين السطور عطل (invariant)", () => {
    // عملة ثانية غير مدعومة بعد، فتُصنع هنا بتجاوز النوع لمحاكاة بيانات فاسدة من القاعدة
    const foreign = {
      ...addon("pt"),
      listPrice: { amountMinor: 100, currency: "USD" } as unknown as Money,
    };
    expect(() => validateCart(cart([foreign]))).toThrow(/cart.currency_mismatch/);
  });
});
