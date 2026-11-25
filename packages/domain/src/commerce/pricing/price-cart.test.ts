import { describe, expect, it } from "vitest";
import { money } from "../../money";
import type { CartLine } from "./cart";
import { parseCouponCode, type CouponCode } from "./coupon-code";
import { MAX_AMOUNT_MINOR } from "./limits";
import { priceCart, type PriceCartInput, type PricedCart } from "./price-cart";
import type { PromotionRule } from "./promotion";
import { candidate, cartLine, promotionRule } from "./test-support";
import { basisPoints } from "./vat";

const NOW = new Date("2026-12-10T12:00:00Z");
const PLAN = cartLine("membership", "plan", 99900, { paidMonths: 12 });
const PT = cartLine("addon", "pt", 45000, { sortOrder: 1 });

function code(value: string): CouponCode {
  const result = parseCouponCode(value);
  if (!result.ok || result.value === null) {
    throw new Error("رمز اختبار غير صالح");
  }
  return result.value;
}

function percent(id: string, bps: number, extra: Partial<PromotionRule> = {}): PromotionRule {
  return promotionRule({ id, discount: { kind: "percentage", rate: basisPoints(bps) }, ...extra });
}

function fixed(id: string, amount: number, extra: Partial<PromotionRule> = {}): PromotionRule {
  return promotionRule({ id, discount: { kind: "fixed_amount", amount: money(amount) }, ...extra });
}

function price(
  lines: readonly CartLine[],
  options: Partial<Omit<PriceCartInput, "lines">> = {},
): PricedCart {
  const result = priceCart({
    lines,
    automatic: [],
    coupon: null,
    vatRate: basisPoints(1500),
    now: NOW,
    standing: "new",
    ...options,
  });
  if (!result.ok) {
    throw new Error(`فشل التسعير: ${result.error.reason}`);
  }
  return result.value;
}

function reasonOf(lines: readonly CartLine[], options: Partial<PriceCartInput> = {}): string {
  const result = priceCart({
    lines,
    automatic: [],
    coupon: null,
    vatRate: basisPoints(1500),
    now: NOW,
    standing: "new",
    ...options,
  });
  if (result.ok) {
    throw new Error("نجح التسعير والمتوقع رفضه");
  }
  expect(result.error.code).toBe("validation");
  return result.error.reason;
}

function minor(cart: PricedCart): Record<string, number> {
  return {
    subtotal: cart.subtotal.amountMinor,
    discount: cart.discount.amountMinor,
    total: cart.total.amountMinor,
    vat: cart.vat.amountMinor,
    net: cart.net.amountMinor,
  };
}

function lineFigures(cart: PricedCart): (readonly number[])[] {
  return cart.lines.map((line) => [
    line.discount.amountMinor,
    line.total.amountMinor,
    line.vat.amountMinor,
    line.net.amountMinor,
  ]);
}

const PLAN_ONLY = { kind: "listed_products", productIds: ["plan"] } as const;
const SAVE = code("save");

describe("priceCart — أمثلة التصميم", () => {
  it("المثال 1: بلا خصم", () => {
    const cart = price([cartLine("membership", "plan", 149900, { paidMonths: 12 })]);
    expect(minor(cart)).toEqual({
      subtotal: 149900,
      discount: 0,
      total: 149900,
      vat: 19552,
      net: 130348,
    });
    expect(cart.discounts).toEqual([]);
    expect(cart.couponOutcome).toEqual({ kind: "none" });
  });

  it("المثال 2: كوبون مئوي مقيَّد بالباقة", () => {
    const coupon = candidate(percent("c", 1250, { code: SAVE, scope: PLAN_ONLY }));
    const cart = price([PLAN, PT], { coupon });
    expect(lineFigures(cart)).toEqual([
      [12488, 87412, 11402, 76010],
      [0, 45000, 5870, 39130],
    ]);
    expect(minor(cart)).toEqual({
      subtotal: 144900,
      discount: 12488,
      total: 132412,
      vat: 17272,
      net: 115140,
    });
    expect(cart.couponOutcome).toEqual({ kind: "applied" });
    expect(cart.discounts).toEqual([
      {
        promotionId: "c",
        source: "coupon",
        code: SAVE,
        name: coupon.rule.name,
        discountRule: coupon.rule.discount,
        sequence: 1,
        amount: money(12488),
      },
    ]);
  });

  it("المثال 3: مبلغ ثابت موزَّع بالباقي الأكبر", () => {
    const lines = [
      cartLine("membership", "plan", 34900, { paidMonths: 3 }),
      cartLine("addon", "a1", 15000, { sortOrder: 1 }),
      cartLine("addon", "a2", 9999, { sortOrder: 2 }),
    ];
    const cart = price(lines, { coupon: candidate(fixed("c", 10000, { code: SAVE })) });
    expect(lineFigures(cart)).toEqual([
      [5827, 29073, 3792, 25281],
      [2504, 12496, 1630, 10866],
      [1669, 8330, 1087, 7243],
    ]);
    expect(minor(cart)).toEqual({
      subtotal: 59899,
      discount: 10000,
      total: 49899,
      vat: 6509,
      net: 43390,
    });
  });

  describe("المثال 4: تراكم مقابل عدم تراكم", () => {
    function scenario(stackable: boolean): PricedCart {
      const automatic = candidate(percent("auto", 1000, { scope: PLAN_ONLY, stackable }));
      const coupon = candidate(fixed("c", 5000, { code: SAVE, stackable }));
      return price([PLAN, PT], { automatic: [automatic], coupon });
    }

    it("الافتراضي: يُطبَّق الأكبر وحده، والكوبون not_combinable ولا يُستهلك", () => {
      const cart = scenario(false);
      expect(lineFigures(cart)).toEqual([
        [9990, 89910, 11727, 78183],
        [0, 45000, 5870, 39130],
      ]);
      expect(minor(cart)).toMatchObject({ total: 134910, vat: 17597 });
      expect(cart.couponOutcome).toEqual({ kind: "not_combinable" });
      expect(cart.discounts.map((d) => [d.promotionId, d.source, d.sequence])).toEqual([
        ["auto", "automatic", 1],
      ]);
    });

    it("كلاهما stackable: التلقائي أولًا ثم الكوبون على المتبقي", () => {
      const cart = scenario(true);
      expect(lineFigures(cart)).toEqual([
        [13322, 86578, 11293, 75285],
        [1668, 43332, 5652, 37680],
      ]);
      expect(minor(cart)).toMatchObject({ total: 129910, discount: 14990, vat: 16945 });
      expect(cart.couponOutcome).toEqual({ kind: "applied" });
      expect(cart.discounts.map((d) => [d.source, d.sequence, d.amount.amountMinor])).toEqual([
        ["automatic", 1, 9990],
        ["coupon", 2, 5000],
      ]);
    });

    it("تراكم من طرف واحد فقط يبقى على الافتراضي الآمن", () => {
      const automatic = candidate(percent("auto", 1000, { scope: PLAN_ONLY, stackable: true }));
      const coupon = candidate(fixed("c", 5000, { code: SAVE }));
      const cart = price([PLAN, PT], { automatic: [automatic], coupon });
      expect(cart.couponOutcome).toEqual({ kind: "not_combinable" });
    });
  });
});

describe("priceCart — حدود الخصم", () => {
  it("الخصم المقيَّد لا يمسّ سطرًا خارج نطاقه", () => {
    const coupon = candidate(fixed("c", 200000, { code: SAVE, scope: PLAN_ONLY }));
    const cart = price([PLAN, PT], { coupon });
    expect(lineFigures(cart)[1]).toEqual([0, 45000, 5870, 39130]);
  });

  it("الخصم الثابت يُقصّ عند الأساس", () => {
    const coupon = candidate(fixed("c", 200000, { code: SAVE, scope: PLAN_ONLY }));
    const cart = price([PLAN, PT], { coupon });
    expect(cart.discount).toEqual(money(99900));
    expect(cart.discounts[0]?.amount).toEqual(money(99900));
  });

  it("خصم 100% يرجع cart.zero_total", () => {
    const coupon = candidate(percent("c", 10000, { code: SAVE }));
    expect(reasonOf([PLAN, PT], { coupon })).toBe("cart.zero_total");
  });

  it("سلة بسعر صفري يرجع cart.zero_total", () => {
    expect(reasonOf([cartLine("membership", "free", 0, { paidMonths: 1 })])).toBe(
      "cart.zero_total",
    );
  });

  it("المجموع فوق حد int4 يرجع cart.amount_out_of_range، وعند الحد مقبول", () => {
    const half = Math.ceil(MAX_AMOUNT_MINOR / 2);
    const big = cartLine("membership", "plan", half, { paidMonths: 1 });
    const addon = cartLine("addon", "pt", half, { sortOrder: 1 });
    expect(reasonOf([big, addon])).toBe("cart.amount_out_of_range");
    const atLimit = price([cartLine("membership", "plan", MAX_AMOUNT_MINOR, { paidMonths: 1 })]);
    expect(atLimit.total).toEqual(money(MAX_AMOUNT_MINOR));
  });

  it("خصم مقرَّب إلى صفر لا يُطبَّق (لا سطر خصم بمبلغ صفري)", () => {
    const tiny = cartLine("membership", "plan", 4, { paidMonths: 1 });
    const cart = price([tiny], { coupon: candidate(percent("c", 1, { code: SAVE })) });
    expect(cart.discounts).toEqual([]);
    expect(cart.couponOutcome).toMatchObject({ kind: "rejected" });
  });
});
