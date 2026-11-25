import { describe, expect, it } from "vitest";
import { money } from "../../money";
import type { CartLine } from "./cart";
import { parseCouponCode } from "./coupon-code";
import { BASIS_POINTS_SCALE } from "./limits";
import { priceCart } from "./price-cart";
import type { PromotionCandidate, PromotionRule, PromotionScope } from "./promotion";
import { mulDivHalfUp } from "./rounding";
import { candidate, cartLine, promotionRule, seededRandom } from "./test-support";
import { basisPoints } from "./vat";

const ROUNDS = 1500;
const MAX_TEST_PRICE = 500_000;
const random = seededRandom(1125);
const couponCode = parseCouponCode("PROP10");

function generatedLines(): readonly CartLine[] {
  const addonCount = random(6);
  const primary = cartLine("membership", "plan", random(MAX_TEST_PRICE), {
    paidMonths: 1 + random(12),
  });
  const addons = Array.from({ length: addonCount }, (_, index) =>
    cartLine("addon", `addon-${String(index)}`, random(MAX_TEST_PRICE), { sortOrder: index }),
  );
  return [primary, ...addons];
}

function generatedScope(lines: readonly CartLine[]): PromotionScope {
  if (random(2) === 0) {
    return { kind: "all_products" };
  }
  return {
    kind: "listed_products",
    productIds: lines.filter(() => random(2) === 0).map((l) => l.productId),
  };
}

function generatedRule(id: string, lines: readonly CartLine[]): PromotionRule {
  const discount =
    random(2) === 0
      ? ({ kind: "percentage", rate: basisPoints(1 + random(BASIS_POINTS_SCALE)) } as const)
      : ({ kind: "fixed_amount", amount: money(1 + random(MAX_TEST_PRICE)) } as const);
  return promotionRule({ id, discount, scope: generatedScope(lines), stackable: random(2) === 0 });
}

function generatedCoupon(lines: readonly CartLine[]): PromotionCandidate | null {
  if (random(2) === 0 || !couponCode.ok || couponCode.value === null) {
    return null;
  }
  return candidate({ ...generatedRule("coupon", lines), code: couponCode.value });
}

describe("priceCart — خصائص لسلال مولّدة ببذرة ثابتة", () => {
  it("مجاميع السطور = الرأس، ولا سالب، والضريبة بالصيغة، والخصومات = خصم الرأس", () => {
    const vatRate = basisPoints(1500);
    for (let round = 0; round < ROUNDS; round += 1) {
      const lines = generatedLines();
      const automatic = Array.from({ length: random(3) }, (_, i) =>
        candidate(generatedRule(`auto-${String(i)}`, lines)),
      );
      const result = priceCart({
        lines,
        automatic,
        coupon: generatedCoupon(lines),
        vatRate,
        now: new Date("2026-12-10T00:00:00Z"),
        standing: "new",
      });
      if (!result.ok) {
        expect(result.error.reason).toBe("cart.zero_total");
        continue;
      }
      const cart = result.value;
      const sum = (pick: (line: (typeof cart.lines)[number]) => number): number =>
        cart.lines.reduce((total, line) => total + pick(line), 0);
      expect(sum((l) => l.listPrice.amountMinor)).toBe(cart.subtotal.amountMinor);
      expect(sum((l) => l.discount.amountMinor)).toBe(cart.discount.amountMinor);
      expect(sum((l) => l.total.amountMinor)).toBe(cart.total.amountMinor);
      expect(sum((l) => l.vat.amountMinor)).toBe(cart.vat.amountMinor);
      expect(cart.total.amountMinor).toBe(cart.subtotal.amountMinor - cart.discount.amountMinor);
      expect(cart.total.amountMinor).toBeGreaterThan(0);
      expect(cart.discounts.reduce((t, d) => t + d.amount.amountMinor, 0)).toBe(
        cart.discount.amountMinor,
      );
      cart.lines.forEach((line, position) => {
        expect(line.position).toBe(position);
        expect(line.discount.amountMinor).toBeGreaterThanOrEqual(0);
        expect(line.total.amountMinor).toBeGreaterThanOrEqual(0);
        expect(line.net.amountMinor).toBeGreaterThanOrEqual(0);
        expect(line.vat.amountMinor).toBe(
          mulDivHalfUp(line.total.amountMinor, 1500, BASIS_POINTS_SCALE + 1500),
        );
      });
      expect(cart.discounts.length).toBeLessThanOrEqual(2);
    }
  });
});
