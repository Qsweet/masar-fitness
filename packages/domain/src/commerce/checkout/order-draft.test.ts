import { describe, expect, it } from "vitest";
import { DomainError } from "../../errors";
import { money, type Currency } from "../../money";
import { basisPoints, type PromotionRule } from "../pricing";
import { candidate, promotionRule } from "../pricing/test-support";
import { buildOrderDraft, type OrderDraft, type OrderFacts } from "./order-draft";
import { DECIDED_POLICY, NOW, PLAN, PROGRAM, PT, code, orderFacts } from "./test-support";

const SAVE = code("save");

function percent(id: string, bps: number, extra: Partial<PromotionRule> = {}): PromotionRule {
  return promotionRule({ id, discount: { kind: "percentage", rate: basisPoints(bps) }, ...extra });
}

function couponRule(id: string, bps: number, extra: Partial<PromotionRule> = {}): PromotionRule {
  return percent(id, bps, { code: SAVE, ...extra });
}

function draft(overrides: Partial<OrderFacts> = {}): OrderDraft {
  const result = buildOrderDraft(orderFacts(overrides));
  if (!result.ok) {
    throw new Error(`فشل بناء المسودة: ${result.error.reason}`);
  }
  return result.value;
}

function failure(overrides: Partial<OrderFacts>): DomainError {
  const result = buildOrderDraft(orderFacts(overrides));
  if (result.ok) {
    throw new Error("كان المتوقع رفض المسودة");
  }
  return result.error;
}

describe("buildOrderDraft — السياسات غير المحسومة", () => {
  it("المهلة NULL تمنع طلب الاشتراك", () => {
    const policy = { ...DECIDED_POLICY, orderPaymentWindowMinutes: null };
    const error = failure({ policy });
    expect(error.code).toBe("conflict");
    expect(error.reason).toBe("policy.undecided.order_payment_window");
  });

  it("المهلة NULL تمنع طلب البرنامج الرقمي أيضًا", () => {
    const policy = { ...DECIDED_POLICY, orderPaymentWindowMinutes: null };
    expect(failure({ policy, primary: PROGRAM }).reason).toBe(
      "policy.undecided.order_payment_window",
    );
  });

  it("قاعدة البدء NULL تمنع طلب الاشتراك", () => {
    const policy = { ...DECIDED_POLICY, membershipStartRule: null };
    expect(failure({ policy }).reason).toBe("policy.undecided.membership_start_rule");
  });

  it("السياستان NULL: المهلة أولًا", () => {
    const policy = {
      ...DECIDED_POLICY,
      orderPaymentWindowMinutes: null,
      membershipStartRule: null,
    };
    expect(failure({ policy }).reason).toBe("policy.undecided.order_payment_window");
  });

  it("البرنامج الرقمي لا يحتاج قاعدة البدء ولا تُختم على سطره", () => {
    const policy = { ...DECIDED_POLICY, membershipStartRule: null };
    const result = draft({ policy, primary: PROGRAM });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.membershipStartRule).toBeNull();
  });

  it("السياسات تُفحص قبل السلة", () => {
    const policy = { ...DECIDED_POLICY, orderPaymentWindowMinutes: null };
    const error = failure({ policy, addons: [PT], attachableAddonProductIds: [] });
    expect(error.reason).toBe("policy.undecided.order_payment_window");
  });
});

describe("buildOrderDraft — السلة والحدود", () => {
  it("خطأ السلة يُرجَع كما هو", () => {
    const error = failure({ addons: [PT], attachableAddonProductIds: [] });
    expect(error.code).toBe("validation");
    expect(error.reason).toBe("cart.addon_not_attachable");
  });

  it("بلوغ حد الطلبات المعلّقة يرجع order.too_many_pending", () => {
    const error = failure({ customer: { standing: "new", pendingOrders: 3 }, maxPendingOrders: 3 });
    expect(error.code).toBe("conflict");
    expect(error.reason).toBe("order.too_many_pending");
  });

  it("ما دون الحد يُقبل", () => {
    const result = draft({ customer: { standing: "new", pendingOrders: 2 }, maxPendingOrders: 3 });
    expect(result.total.amountMinor).toBe(PLAN.listPrice.amountMinor);
  });

  it("الحد يُفحص قبل الكوبون غير المعروف", () => {
    const error = failure({
      customer: { standing: "existing", pendingOrders: 1 },
      maxPendingOrders: 1,
      coupon: { kind: "unknown_code", code: SAVE },
    });
    expect(error.reason).toBe("order.too_many_pending");
  });

  it("حد غير موجب عطل استدعاء", () => {
    expect(() => buildOrderDraft(orderFacts({ maxPendingOrders: 0 }))).toThrow(
      "invariant: order.invalid_pending_limit",
    );
  });

  it("الإجمالي صفر مرفوض", () => {
    const coupon = { kind: "found", candidate: candidate(couponRule("c100", 10000)) } as const;
    expect(failure({ coupon }).reason).toBe("cart.zero_total");
  });

  it("عملة السلة المخالفة لعملة النادي عطل بيانات", () => {
    const policy = { ...DECIDED_POLICY, currency: "USD" as string as Currency };
    expect(() => buildOrderDraft(orderFacts({ policy }))).toThrow(
      "invariant: order.currency_mismatch",
    );
  });
});

describe("buildOrderDraft — الكوبون", () => {
  it("الرمز غير المعروف not_found على الحقل coupon", () => {
    const error = failure({ coupon: { kind: "unknown_code", code: SAVE } });
    expect(error.code).toBe("not_found");
    expect(error.reason).toBe("coupon.unknown");
    expect(error.field).toBe("coupon");
  });

  it("الكوبون المرفوض يرجع خطأه نفسه بصنف validation على الحقل coupon", () => {
    const ended = couponRule("c1", 1000, { endsAt: NOW });
    const error = failure({ coupon: { kind: "found", candidate: candidate(ended) } });
    expect(error.code).toBe("validation");
    expect(error.reason).toBe("promotion.ended");
    expect(error.field).toBe("coupon");
    expect(error.cause).toBeInstanceOf(DomainError);
  });

  it("الكوبون الخاسر أمام عرض أفضل لا يمنع الإنشاء ولا يُستهلك", () => {
    const result = draft({
      automatic: [candidate(percent("auto", 2000))],
      coupon: { kind: "found", candidate: candidate(couponRule("c1", 1000)) },
    });
    expect(result.couponOutcome).toEqual({ kind: "not_combinable" });
    expect(result.discounts.map((discount) => discount.promotionId)).toEqual(["auto"]);
  });

  it("الكوبون المطبَّق يُسجَّل خصمه بمصدره ورمزه (مثال 2 هللةً بهللة)", () => {
    const rule = couponRule("c1", 1250, {
      scope: { kind: "listed_products", productIds: ["plan"] },
    });
    const result = draft({
      addons: [PT],
      coupon: { kind: "found", candidate: candidate(rule) },
    });
    expect(result.couponOutcome).toEqual({ kind: "applied" });
    expect(result.discounts).toHaveLength(1);
    expect(result.discounts[0]).toMatchObject({ source: "coupon", code: SAVE, sequence: 1 });
    expect(result.subtotal).toEqual(money(144900));
    expect(result.discount).toEqual(money(12488));
    expect(result.total).toEqual(money(132412));
    expect(result.vat).toEqual(money(17272));
  });
});

describe("buildOrderDraft — المكانة الحقيقية", () => {
  const forNew = percent("welcome", 1000, { audience: "new_customer" });

  it("عرض العملاء الجدد يُطبَّق على عميل جديد", () => {
    const result = draft({ automatic: [candidate(forNew)] });
    expect(result.discounts.map((discount) => discount.promotionId)).toEqual(["welcome"]);
    expect(result.discount).toEqual(money(9990));
  });

  it("ولا يُطبَّق على عميل قائم", () => {
    const result = draft({
      automatic: [candidate(forNew)],
      customer: { standing: "existing", pendingOrders: 0 },
    });
    expect(result.discounts).toEqual([]);
    expect(result.total).toEqual(PLAN.listPrice);
  });
});

describe("buildOrderDraft — اللقطة", () => {
  it("تحمل الاسم والمدة والمزايا والسعر وقاعدة البدء المختومة", () => {
    const policy = { ...DECIDED_POLICY, membershipStartRule: "on_first_visit" } as const;
    const result = draft({ policy, addons: [PT] });
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toEqual({
      position: 0,
      kind: "membership",
      productId: PLAN.productId,
      versionId: PLAN.versionId,
      slug: PLAN.slug,
      name: PLAN.name,
      summary: PLAN.summary,
      benefits: PLAN.benefits,
      paidMonths: 3,
      bonusMonths: 1,
      membershipStartRule: "on_first_visit",
      listPrice: money(99900),
      discount: money(0),
      total: money(99900),
      vat: money(13030),
    });
    expect(result.items[1]).toMatchObject({
      position: 1,
      kind: "addon",
      membershipStartRule: null,
    });
  });

  it("الرأس من السطور والمهلة من سياسة النادي", () => {
    const result = draft({ addons: [PT], locale: "en" });
    expect(result.currency).toBe("SAR");
    expect(result.vatRate).toBe(DECIDED_POLICY.vatRate);
    expect(result.locale).toBe("en");
    expect(result.buyer.mobile).toBe("+966551234567");
    expect(result.subtotal).toEqual(money(144900));
    expect(result.vat.amountMinor).toBe(
      result.items.reduce((sum, item) => sum + item.vat.amountMinor, 0),
    );
    expect(result.createdAt).toEqual(NOW);
    expect(result.expiresAt).toEqual(new Date("2026-12-10T12:30:00Z"));
    expect(result.couponOutcome).toEqual({ kind: "none" });
  });
});
