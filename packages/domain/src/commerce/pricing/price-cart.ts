import { DomainError } from "../../errors";
import { money, type Currency, type Money } from "../../money";
import { err, ok, type Result } from "../../result";
import {
  applyPromotion,
  evaluateCoupon,
  selectAutomatic,
  type CouponEvaluation,
  type EvaluatedPromotion,
  type PricingSlot,
  type PromotionApplication,
  type RejectedPromotion,
} from "./apply-promotion";
import { lineCurrency, type CartLine } from "./cart";
import type { CouponCode } from "./coupon-code";
import { MAX_AMOUNT_MINOR } from "./limits";
import type {
  CustomerStanding,
  PromotionCandidate,
  PromotionContext,
  PromotionRule,
} from "./promotion";
import { vatIncludedIn, type BasisPoints } from "./vat";

export type CouponOutcome =
  | { readonly kind: "none" }
  | { readonly kind: "applied" }
  /** الكوبون صالح لكن خصمه لم يغلب عرضًا تلقائيًا غير قابل للتراكم معه، فلا يُستهلك. */
  | { readonly kind: "not_combinable" }
  | { readonly kind: "rejected"; readonly error: DomainError };

export type DiscountSequence = 1 | 2;

export interface AppliedDiscount {
  readonly promotionId: string;
  readonly source: "automatic" | "coupon";
  readonly code: CouponCode | null;
  readonly name: PromotionRule["name"];
  readonly discountRule: PromotionRule["discount"];
  readonly sequence: DiscountSequence;
  readonly amount: Money;
}

export type PricedLine = CartLine & {
  readonly position: number;
  readonly discount: Money;
  readonly total: Money;
  readonly vat: Money;
  readonly net: Money;
};

export interface PricedCart {
  readonly currency: Currency;
  readonly vatRate: BasisPoints;
  readonly lines: readonly PricedLine[];
  readonly discounts: readonly AppliedDiscount[];
  readonly couponOutcome: CouponOutcome;
  readonly rejectedAutomatic: readonly RejectedPromotion[];
  readonly subtotal: Money;
  readonly discount: Money;
  readonly total: Money;
  readonly vat: Money;
  readonly net: Money;
}

export interface PriceCartInput {
  /** سطور `validateCart` مرتبة: الأساسي في الموضع 0 ثم الإضافات. */
  readonly lines: readonly CartLine[];
  readonly automatic: readonly PromotionCandidate[];
  readonly coupon: PromotionCandidate | null;
  readonly vatRate: BasisPoints;
  readonly now: Date;
  readonly standing: CustomerStanding;
}

interface AppliedPromotion {
  readonly candidate: PromotionCandidate;
  readonly source: AppliedDiscount["source"];
  readonly sequence: DiscountSequence;
  readonly application: PromotionApplication;
}

interface DiscountPlan {
  readonly applied: readonly AppliedPromotion[];
  readonly couponOutcome: CouponOutcome;
}

const APPLIED: CouponOutcome = { kind: "applied" };
const NOT_COMBINABLE: CouponOutcome = { kind: "not_combinable" };

function first(evaluated: EvaluatedPromotion, source: AppliedDiscount["source"]): AppliedPromotion {
  return { candidate: evaluated.candidate, source, sequence: 1, application: evaluated.alone };
}

/** تلقائي ثم كوبون على المتبقي بعده (تتابعيًا لا جمعيًا)، ولا يكون إلا والاثنان قابلين للتراكم. */
function stack(
  automatic: EvaluatedPromotion,
  coupon: EvaluatedPromotion,
  slots: readonly PricingSlot[],
  currency: string,
): DiscountPlan {
  const afterAutomatic = slots.map((slot, index) => ({
    productId: slot.productId,
    remaining: slot.remaining - (automatic.alone.shares[index] ?? 0),
  }));
  const second = applyPromotion(coupon.candidate.rule, afterAutomatic, currency);
  if (second === null) {
    const error = new DomainError("conflict", "promotion.not_applicable");
    return { applied: [first(automatic, "automatic")], couponOutcome: { kind: "rejected", error } };
  }
  const couponStep: AppliedPromotion = {
    candidate: coupon.candidate,
    source: "coupon",
    sequence: 2,
    application: second,
  };
  return { applied: [first(automatic, "automatic"), couponStep], couponOutcome: APPLIED };
}

/**
 * يقرر ما يُطبَّق. الافتراضي الآمن: الأكبر خصمًا منفردًا على أسعار القائمة، والتعادل للتلقائي
 * فلا يُستهلك استخدام كوبون محدود. التراكم فقط إن كان الاثنان `stackable`.
 */
function planDiscounts(
  automatic: EvaluatedPromotion | null,
  coupon: CouponEvaluation,
  slots: readonly PricingSlot[],
  currency: string,
): DiscountPlan {
  if (coupon.kind !== "eligible") {
    const couponOutcome: CouponOutcome =
      coupon.kind === "none" ? coupon : { kind: "rejected", error: coupon.error };
    return { applied: automatic === null ? [] : [first(automatic, "automatic")], couponOutcome };
  }
  const { evaluated } = coupon;
  if (automatic === null) {
    return { applied: [first(evaluated, "coupon")], couponOutcome: APPLIED };
  }
  if (automatic.candidate.rule.stackable && evaluated.candidate.rule.stackable) {
    return stack(automatic, evaluated, slots, currency);
  }
  return evaluated.alone.amount > automatic.alone.amount
    ? { applied: [first(evaluated, "coupon")], couponOutcome: APPLIED }
    : { applied: [first(automatic, "automatic")], couponOutcome: NOT_COMBINABLE };
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/** عملة السلة، مع ثوابت السطور: سلة غير فارغة، وعملة واحدة، وأسعار صحيحة غير سالبة. */
function cartCurrency(lines: readonly CartLine[]): Currency {
  const [primary] = lines;
  if (primary === undefined) {
    throw new DomainError("invariant", "cart.empty");
  }
  for (const line of lines) {
    if (lineCurrency(line) !== lineCurrency(primary)) {
      throw new DomainError("invariant", "cart.currency_mismatch");
    }
    if (line.listPrice.amountMinor < 0) {
      throw new DomainError("invariant", "cart.negative_list_price");
    }
  }
  return primary.listPrice.currency;
}

/** لكل سطر: الخصم مجموع ما وُزّع عليه، والضريبة مستخرجة من إجماليه بالنصف يُرفع. */
function priceLines(
  lines: readonly CartLine[],
  applied: readonly AppliedPromotion[],
  vatRate: BasisPoints,
  currency: Currency,
): readonly PricedLine[] {
  return lines.map((line, position) => {
    const discount = sum(applied.map((step) => step.application.shares[position] ?? 0));
    const total = money(line.listPrice.amountMinor - discount, currency);
    const vat = vatIncludedIn(total, vatRate);
    const net = money(total.amountMinor - vat.amountMinor, currency);
    return { ...line, position, discount: money(discount, currency), total, vat, net };
  });
}

function toAppliedDiscount(step: AppliedPromotion, currency: Currency): AppliedDiscount {
  const { rule } = step.candidate;
  return {
    promotionId: rule.id,
    source: step.source,
    code: rule.code,
    name: rule.name,
    discountRule: rule.discount,
    sequence: step.sequence,
    amount: money(step.application.amount, currency),
  };
}

function headerTotal(lines: readonly PricedLine[], pick: (line: PricedLine) => Money): number {
  return sum(lines.map((line) => pick(line).amountMinor));
}

/** السطور هي المرجع: الرأس مجموعها. */
function assemble(
  base: Pick<PricedCart, "currency" | "vatRate" | "rejectedAutomatic" | "couponOutcome">,
  lines: readonly PricedLine[],
  discounts: readonly AppliedDiscount[],
): PricedCart {
  const total = headerTotal(lines, (line) => line.total);
  const vat = headerTotal(lines, (line) => line.vat);
  return {
    ...base,
    lines,
    discounts,
    subtotal: money(
      headerTotal(lines, (line) => line.listPrice),
      base.currency,
    ),
    discount: money(
      headerTotal(lines, (line) => line.discount),
      base.currency,
    ),
    total: money(total, base.currency),
    vat: money(vat, base.currency),
    net: money(total - vat, base.currency),
  };
}

function isLineConsistent(line: PricedLine): boolean {
  return (
    line.discount.amountMinor >= 0 &&
    line.total.amountMinor === line.listPrice.amountMinor - line.discount.amountMinor &&
    line.vat.amountMinor >= 0 &&
    line.vat.amountMinor <= line.total.amountMinor &&
    line.net.amountMinor === line.total.amountMinor - line.vat.amountMinor
  );
}

/** فحص أخير قبل الإرجاع: أي خرق هنا عطل في المحرك لا خطأ عميل. */
function assertPricedInvariants(cart: PricedCart): void {
  const appliedTotal = sum(cart.discounts.map((discount) => discount.amount.amountMinor));
  const consistent =
    cart.lines.every(isLineConsistent) &&
    appliedTotal === cart.discount.amountMinor &&
    cart.total.amountMinor === cart.subtotal.amountMinor - cart.discount.amountMinor &&
    cart.net.amountMinor >= 0;
  if (!consistent) {
    throw new DomainError("invariant", "pricing.totals_mismatch");
  }
}

/**
 * محرك التسعير: دالة خالصة حتمية. الأسعار شاملة الضريبة، والضريبة تُستخرج لكل سطر.
 * التفاصيل والأمثلة في قسم «محرك التسعير» من `docs/PHASE3_COMMERCE_DESIGN.md`.
 */
export function priceCart(input: PriceCartInput): Result<PricedCart, DomainError> {
  const currency = cartCurrency(input.lines);
  const subtotal = sum(input.lines.map((line) => line.listPrice.amountMinor));
  if (subtotal > MAX_AMOUNT_MINOR) {
    return err(new DomainError("validation", "cart.amount_out_of_range"));
  }
  const slots = input.lines.map((line) => ({
    productId: line.productId,
    remaining: line.listPrice.amountMinor,
  }));
  const ctx: PromotionContext = { now: input.now, standing: input.standing };
  const automatic = selectAutomatic(input.automatic, slots, ctx, currency);
  const coupon = evaluateCoupon(input.coupon, slots, ctx, currency);
  const plan = planDiscounts(automatic.best, coupon, slots, currency);
  const cart = assemble(
    {
      currency,
      vatRate: input.vatRate,
      rejectedAutomatic: automatic.rejected,
      couponOutcome: plan.couponOutcome,
    },
    priceLines(input.lines, plan.applied, input.vatRate, currency),
    plan.applied.map((step) => toAppliedDiscount(step, currency)),
  );
  if (cart.total.amountMinor === 0) {
    return err(new DomainError("validation", "cart.zero_total"));
  }
  assertPricedInvariants(cart);
  return ok(cart);
}
