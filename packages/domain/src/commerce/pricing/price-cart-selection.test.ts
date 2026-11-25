import { describe, expect, it } from "vitest";
import { money } from "../../money";
import type { CartLine } from "./cart";
import { parseCouponCode, type CouponCode } from "./coupon-code";
import { priceCart, type PriceCartInput, type PricedCart } from "./price-cart";
import type { PromotionRule } from "./promotion";
import { candidate, cartLine, promotionRule } from "./test-support";
import { basisPoints } from "./vat";

const NOW = new Date("2026-12-10T12:00:00Z");
const PLAN = cartLine("membership", "plan", 99900, { paidMonths: 12 });
const PT = cartLine("addon", "pt", 45000, { sortOrder: 1 });
const PLAN_ONLY = { kind: "listed_products", productIds: ["plan"] } as const;

function code(value: string): CouponCode {
  const result = parseCouponCode(value);
  if (!result.ok || result.value === null) {
    throw new Error("رمز اختبار غير صالح");
  }
  return result.value;
}

const SAVE = code("save");

function percent(id: string, bps: number, extra: Partial<PromotionRule> = {}): PromotionRule {
  return promotionRule({ id, discount: { kind: "percentage", rate: basisPoints(bps) }, ...extra });
}

function fixed(id: string, amount: number, extra: Partial<PromotionRule> = {}): PromotionRule {
  return promotionRule({ id, discount: { kind: "fixed_amount", amount: money(amount) }, ...extra });
}

function price(lines: readonly CartLine[], options: Partial<PriceCartInput> = {}): PricedCart {
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

function appliedIds(cart: PricedCart): readonly string[] {
  return cart.discounts.map((discount) => discount.promotionId);
}

describe("priceCart — اختيار العرض التلقائي", () => {
  it("يُختار الأعلى خصمًا من التلقائيين المؤهلين", () => {
    const automatic = [candidate(percent("small", 500)), candidate(percent("big", 1000))];
    expect(appliedIds(price([PLAN], { automatic }))).toEqual(["big"]);
  });

  it("التعادل للأقدم بداية ثم للمعرّف الأصغر", () => {
    const older = percent("z-older", 1000, { startsAt: new Date("2026-01-01T00:00:00Z") });
    const newer = percent("a-newer", 1000, { startsAt: new Date("2026-06-01T00:00:00Z") });
    expect(appliedIds(price([PLAN], { automatic: [candidate(newer), candidate(older)] }))).toEqual([
      "z-older",
    ]);
    const twinB = percent("b", 1000);
    const twinA = percent("a", 1000);
    expect(appliedIds(price([PLAN], { automatic: [candidate(twinB), candidate(twinA)] }))).toEqual([
      "a",
    ]);
  });

  it("يسجّل سبب رفض التلقائي غير المؤهل ولا يطبّقه", () => {
    const automatic = [
      candidate(percent("draft", 5000, { status: "draft" })),
      candidate(
        percent("pt-only", 5000, { scope: { kind: "listed_products", productIds: ["pt"] } }),
      ),
      candidate(percent("ok", 1000)),
    ];
    const cart = price([PLAN], { automatic });
    expect(appliedIds(cart)).toEqual(["ok"]);
    expect(cart.rejectedAutomatic).toEqual([
      { promotionId: "draft", reason: "promotion.inactive" },
      { promotionId: "pt-only", reason: "promotion.not_applicable" },
    ]);
  });

  it("المكانة unknown لا تطبّق عرض جمهور، والمكانة الحقيقية تطبّقه", () => {
    const automatic = [candidate(percent("new-only", 1000, { audience: "new_customer" }))];
    const quote = price([PLAN], { automatic, standing: "unknown" });
    expect(quote.discounts).toEqual([]);
    expect(quote.rejectedAutomatic).toEqual([
      { promotionId: "new-only", reason: "promotion.audience_unverified" },
    ]);
    expect(appliedIds(price([PLAN], { automatic, standing: "new" }))).toEqual(["new-only"]);
  });
});

describe("priceCart — الكوبون", () => {
  it("الكوبون المرفوض يُرجَع بخطئه، والتلقائي يبقى مطبَّقًا", () => {
    const coupon = candidate(fixed("c", 5000, { code: SAVE, maxRedemptions: 1 }), 1);
    const cart = price([PLAN], { automatic: [candidate(percent("auto", 1000))], coupon });
    expect(appliedIds(cart)).toEqual(["auto"]);
    expect(cart.couponOutcome.kind).toBe("rejected");
    if (cart.couponOutcome.kind === "rejected") {
      expect(cart.couponOutcome.error.reason).toBe("promotion.exhausted");
    }
  });

  it("الكوبون الأكبر خصمًا يغلب التلقائي غير القابل للتراكم", () => {
    const coupon = candidate(fixed("c", 20000, { code: SAVE }));
    const cart = price([PLAN], { automatic: [candidate(percent("auto", 1000))], coupon });
    expect(appliedIds(cart)).toEqual(["c"]);
    expect(cart.couponOutcome).toEqual({ kind: "applied" });
    expect(cart.discounts[0]?.sequence).toBe(1);
  });

  it("التعادل بين تلقائي وكوبون للتلقائي، فلا يُستهلك الكوبون", () => {
    const coupon = candidate(fixed("c", 9990, { code: SAVE }));
    const cart = price([PLAN], { automatic: [candidate(percent("auto", 1000))], coupon });
    expect(appliedIds(cart)).toEqual(["auto"]);
    expect(cart.couponOutcome).toEqual({ kind: "not_combinable" });
  });

  it("كوبون قابل للتراكم لا يبقى له أساس بعد التلقائي: مرفوض ولا يُطبَّق", () => {
    const automatic = [candidate(percent("auto", 10000, { scope: PLAN_ONLY, stackable: true }))];
    const coupon = candidate(fixed("c", 1000, { code: SAVE, scope: PLAN_ONLY, stackable: true }));
    const cart = price([PLAN, PT], { automatic, coupon });
    expect(appliedIds(cart)).toEqual(["auto"]);
    expect(cart.couponOutcome).toMatchObject({ kind: "rejected" });
  });

  it("عرض تلقائي برمز أو كوبون بلا رمز عطل (invariant)", () => {
    const withCode = candidate(percent("auto", 1000, { code: SAVE }));
    expect(() => price([PLAN], { automatic: [withCode] })).toThrow(/automatic_with_code/);
    const withoutCode = candidate(percent("c", 1000));
    expect(() => price([PLAN], { coupon: withoutCode })).toThrow(/coupon_without_code/);
  });

  it("خصم ثابت غير موجب في البيانات عطل (invariant)", () => {
    const broken = candidate(fixed("c", 0, { code: SAVE }));
    expect(() => price([PLAN], { coupon: broken })).toThrow(/invalid_fixed_amount/);
  });

  it("السلة الفارغة عطل (invariant)", () => {
    expect(() => price([])).toThrow(/cart.empty/);
  });
});
