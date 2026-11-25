import { DomainError } from "../../errors";
import type { Currency, Money } from "../../money";
import { err, ok, type Result } from "../../result";
import {
  orderExpiry,
  type Buyer,
  type MembershipStartRule,
  type RequestLocale,
} from "../lifecycle";
import {
  priceCart,
  validateCart,
  type AppliedDiscount,
  type BasisPoints,
  type CartLine,
  type CouponCode,
  type CouponOutcome,
  type CustomerStanding,
  type PricedCart,
  type PricedLine,
  type PromotionCandidate,
} from "../pricing";
import { decidedCheckout, type CommercePolicy } from "./commerce-policy";

/** الكوبون كما وجدته طبقة القاعدة: لا رمز، أو رمز لا عرض له، أو عرض مرشّح. */
export type CouponFact =
  | { readonly kind: "none" }
  | { readonly kind: "unknown_code"; readonly code: CouponCode }
  | { readonly kind: "found"; readonly candidate: PromotionCandidate };

/** الحقائق التي تجمعها طبقة القاعدة تحت الأقفال ثم تمرّرها كما هي. */
export interface OrderFacts {
  readonly primary: CartLine;
  readonly addons: readonly CartLine[];
  readonly attachableAddonProductIds: readonly string[];
  readonly policy: CommercePolicy;
  readonly automatic: readonly PromotionCandidate[];
  readonly coupon: CouponFact;
  readonly customer: {
    readonly standing: Exclude<CustomerStanding, "unknown">;
    readonly pendingOrders: number;
  };
  readonly maxPendingOrders: number;
  readonly buyer: Buyer;
  readonly locale: RequestLocale;
  readonly now: Date;
}

/** سطر الطلب كما يُكتب في `order_items`: لقطة لا تتغير بعد الإنشاء. */
export interface OrderItemDraft {
  readonly position: number;
  readonly kind: CartLine["kind"];
  readonly productId: string;
  readonly versionId: string;
  readonly slug: string;
  readonly name: CartLine["name"];
  readonly summary: CartLine["summary"];
  readonly benefits: CartLine["benefits"];
  readonly paidMonths: number | null;
  readonly bonusMonths: number;
  /** القاعدة المختومة على سطر الاشتراك، وnull لغيره. */
  readonly membershipStartRule: MembershipStartRule | null;
  readonly listPrice: Money;
  readonly discount: Money;
  readonly total: Money;
  readonly vat: Money;
}

/** الكوبون المرفوض لا يصل إلى مسودة: يُرجَع خطأً على الحقل. */
export type DraftCouponOutcome = Exclude<CouponOutcome, { readonly kind: "rejected" }>;

/** ما يُكتب حرفيًا في `orders` و`order_items` و`order_discounts`. */
export interface OrderDraft {
  readonly buyer: Buyer;
  readonly locale: RequestLocale;
  readonly currency: Currency;
  readonly vatRate: BasisPoints;
  readonly items: readonly OrderItemDraft[];
  readonly discounts: readonly AppliedDiscount[];
  readonly subtotal: Money;
  readonly discount: Money;
  readonly total: Money;
  readonly vat: Money;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly couponOutcome: DraftCouponOutcome;
}

/** خطأ الكوبون يظهر بجانب حقله، ويبقى الخطأ الأصلي سببًا له. */
export function couponFieldError(
  code: "validation" | "not_found",
  source: string | DomainError,
): DomainError {
  const reason = typeof source === "string" ? source : source.reason;
  const cause = typeof source === "string" ? undefined : source;
  return new DomainError(code, reason, { field: "coupon", cause });
}

/** خطأ الكوبون غير المعروف، مشترك بين المسودة وعرض السعر. */
export function unknownCouponError(): DomainError {
  return couponFieldError("not_found", "coupon.unknown");
}

function assertCount(value: number, minimum: number, reason: string): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new DomainError("invariant", reason);
  }
}

/** حد الطلبات المعلّقة للعميل؛ الحد نفسه ثابت تقني يمرّره المستدعي. */
function checkPendingLimit(facts: OrderFacts): Result<true, DomainError> {
  assertCount(facts.maxPendingOrders, 1, "order.invalid_pending_limit");
  assertCount(facts.customer.pendingOrders, 0, "order.invalid_pending_count");
  if (facts.customer.pendingOrders >= facts.maxPendingOrders) {
    return err(new DomainError("conflict", "order.too_many_pending"));
  }
  return ok(true);
}

/** عملة السلة يجب أن تكون عملة النادي؛ الخلاف عطل بيانات لا خطأ عميل. */
function assertPolicyCurrency(cart: PricedCart, policy: CommercePolicy): void {
  const cartCurrency: string = cart.currency;
  const policyCurrency: string = policy.currency;
  if (cartCurrency !== policyCurrency) {
    throw new DomainError("invariant", "order.currency_mismatch");
  }
}

function toItem(line: PricedLine, startRule: MembershipStartRule | null): OrderItemDraft {
  return {
    position: line.position,
    kind: line.kind,
    productId: line.productId,
    versionId: line.versionId,
    slug: line.slug,
    name: line.name,
    summary: line.summary,
    benefits: line.benefits,
    paidMonths: line.paidMonths,
    bonusMonths: line.bonusMonths,
    membershipStartRule: line.kind === "membership" ? startRule : null,
    listPrice: line.listPrice,
    discount: line.discount,
    total: line.total,
    vat: line.vat,
  };
}

/** تسعير السلة بالمكانة الحقيقية. الكوبون المرفوض خطأ على حقله ولا يُتجاهل بصمت. */
function priceForOrder(
  facts: OrderFacts,
  lines: readonly CartLine[],
): Result<{ cart: PricedCart; couponOutcome: DraftCouponOutcome }, DomainError> {
  const priced = priceCart({
    lines,
    automatic: facts.automatic,
    coupon: facts.coupon.kind === "found" ? facts.coupon.candidate : null,
    vatRate: facts.policy.vatRate,
    now: facts.now,
    standing: facts.customer.standing,
  });
  if (!priced.ok) {
    return priced;
  }
  const { couponOutcome } = priced.value;
  if (couponOutcome.kind === "rejected") {
    return err(couponFieldError("validation", couponOutcome.error));
  }
  return ok({ cart: priced.value, couponOutcome });
}

/**
 * الدالة الوحيدة التي تقرر ما يُكتب في الطلب. الترتيب ثابت: السياسات غير المحسومة، ثم السلة،
 * ثم حد الطلبات المعلّقة، ثم الكوبون غير المعروف، ثم التسعير، ثم المهلة.
 */
export function buildOrderDraft(facts: OrderFacts): Result<OrderDraft, DomainError> {
  const decided = decidedCheckout(facts.policy, facts.primary.kind);
  if (!decided.ok) {
    return decided;
  }
  const lines = validateCart(facts);
  if (!lines.ok) {
    return lines;
  }
  const pending = checkPendingLimit(facts);
  if (!pending.ok) {
    return pending;
  }
  if (facts.coupon.kind === "unknown_code") {
    return err(unknownCouponError());
  }
  const priced = priceForOrder(facts, lines.value);
  if (!priced.ok) {
    return priced;
  }
  const { cart, couponOutcome } = priced.value;
  assertPolicyCurrency(cart, facts.policy);
  return ok({
    buyer: facts.buyer,
    locale: facts.locale,
    currency: cart.currency,
    vatRate: cart.vatRate,
    items: cart.lines.map((line) => toItem(line, decided.value.membershipStartRule)),
    discounts: cart.discounts,
    subtotal: cart.subtotal,
    discount: cart.discount,
    total: cart.total,
    vat: cart.vat,
    createdAt: facts.now,
    expiresAt: orderExpiry(facts.now, decided.value.paymentWindowMinutes),
    couponOutcome,
  });
}
