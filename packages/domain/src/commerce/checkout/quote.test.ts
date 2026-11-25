import { describe, expect, it } from "vitest";
import { DomainError } from "../../errors";
import { money } from "../../money";
import { basisPoints, type PromotionRule } from "../pricing";
import { candidate, promotionRule } from "../pricing/test-support";
import { buildOrderDraft } from "./order-draft";
import { buildQuote, type Quote, type QuoteFacts } from "./quote";
import { DECIDED_POLICY, NOW, PLAN, PROGRAM, PT, code, orderFacts } from "./test-support";

const SAVE = code("save");

function percent(id: string, bps: number, extra: Partial<PromotionRule> = {}): PromotionRule {
  return promotionRule({ id, discount: { kind: "percentage", rate: basisPoints(bps) }, ...extra });
}

function quoteFacts(overrides: Partial<QuoteFacts> = {}): QuoteFacts {
  const { primary, addons, attachableAddonProductIds, policy, automatic, coupon, now } =
    orderFacts();
  return {
    primary,
    addons,
    attachableAddonProductIds,
    policy,
    automatic,
    coupon,
    now,
    ...overrides,
  };
}

function quote(overrides: Partial<QuoteFacts> = {}): Quote {
  const result = buildQuote(quoteFacts(overrides));
  if (!result.ok) {
    throw new Error(`فشل عرض السعر: ${result.error.reason}`);
  }
  return result.value;
}

describe("buildQuote — السياسات", () => {
  it("السياسات المحسومة: لا موانع، والقاعدة المختومة معروضة", () => {
    const result = quote({ addons: [PT] });
    expect(result.blockers).toEqual([]);
    expect(result.membershipStartRule).toBe("on_payment");
    expect(result.total).toEqual(money(144900));
    expect(result.couponError).toBeNull();
  });

  it("السياسات غير المحسومة تُعرض ولا تُرجَع خطأً", () => {
    const policy = {
      ...DECIDED_POLICY,
      orderPaymentWindowMinutes: null,
      membershipStartRule: null,
    };
    const result = quote({ policy });
    expect(result.blockers).toEqual(["order_payment_window", "membership_start_rule"]);
    expect(result.membershipStartRule).toBeNull();
    expect(result.total).toEqual(PLAN.listPrice);
  });

  it("البرنامج الرقمي: لا قاعدة بدء ولا مانع لها", () => {
    const policy = { ...DECIDED_POLICY, membershipStartRule: null };
    const result = quote({ policy, primary: PROGRAM });
    expect(result.blockers).toEqual([]);
    expect(result.membershipStartRule).toBeNull();
  });

  it("البرنامج الرقمي لا تُعرض له قاعدة البدء ولو كانت محسومة", () => {
    expect(quote({ primary: PROGRAM }).membershipStartRule).toBeNull();
  });

  it("خطأ السلة يُرجَع خطأً", () => {
    const result = buildQuote(quoteFacts({ addons: [PT], attachableAddonProductIds: [] }));
    expect(result.ok ? null : result.error.reason).toBe("cart.addon_not_attachable");
  });
});

describe("buildQuote — المكانة unknown", () => {
  const forNew = percent("welcome", 1000, { audience: "new_customer" });

  it("عرض العملاء الجدد لا يُطبَّق ويُعلَّم audience_unverified", () => {
    const result = quote({ automatic: [candidate(forNew)] });
    expect(result.discounts).toEqual([]);
    expect(result.total).toEqual(PLAN.listPrice);
    expect(result.rejectedAutomatic).toEqual([
      { promotionId: "welcome", reason: "promotion.audience_unverified" },
    ]);
  });

  it("والعرض نفسه يُطبَّق في المسودة بالمكانة الحقيقية", () => {
    const result = buildOrderDraft(orderFacts({ automatic: [candidate(forNew)] }));
    expect(result.ok ? result.value.discount : null).toEqual(money(9990));
  });

  it("الكوبون المقيَّد بجمهور يظهر خطأً على حقله بسبب audience_unverified", () => {
    const rule = percent("c1", 1000, { code: SAVE, audience: "new_customer" });
    const result = quote({ coupon: { kind: "found", candidate: candidate(rule) } });
    expect(result.couponError?.reason).toBe("promotion.audience_unverified");
    expect(result.couponError?.field).toBe("coupon");
    expect(result.total).toEqual(PLAN.listPrice);
  });

  it("العرض المفتوح للجميع يعطي الإجمالي نفسه في العرض والمسودة", () => {
    const automatic = [candidate(percent("open", 1000))];
    const draft = buildOrderDraft(orderFacts({ automatic, addons: [PT] }));
    expect(quote({ automatic, addons: [PT] }).total).toEqual(
      draft.ok ? draft.value.total : undefined,
    );
  });
});

describe("buildQuote — الكوبون", () => {
  it("الرمز غير المعروف: not_found على الحقل coupon والسعر بلا خصم", () => {
    const result = quote({ coupon: { kind: "unknown_code", code: SAVE } });
    expect(result.couponError?.code).toBe("not_found");
    expect(result.couponError?.reason).toBe("coupon.unknown");
    expect(result.couponError?.field).toBe("coupon");
    expect(result.total).toEqual(PLAN.listPrice);
  });

  it("الكوبون المنتهي: validation على الحقل coupon والسعر بلا خصمه", () => {
    const ended = percent("c1", 1000, { code: SAVE, endsAt: NOW });
    const result = quote({ coupon: { kind: "found", candidate: candidate(ended) } });
    expect(result.couponError?.code).toBe("validation");
    expect(result.couponError?.reason).toBe("promotion.ended");
    expect(result.couponError?.cause).toBeInstanceOf(DomainError);
    expect(result.discounts).toEqual([]);
    expect(result.total).toEqual(PLAN.listPrice);
  });

  it("الكوبون الصالح يُطبَّق بلا خطأ", () => {
    const rule = percent("c1", 1000, { code: SAVE });
    const result = quote({ coupon: { kind: "found", candidate: candidate(rule) } });
    expect(result.couponError).toBeNull();
    expect(result.couponOutcome).toEqual({ kind: "applied" });
    expect(result.discount).toEqual(money(9990));
  });

  it("الكوبون الخاسر يُذكر not_combinable بلا خطأ", () => {
    const result = quote({
      automatic: [candidate(percent("auto", 2000))],
      coupon: { kind: "found", candidate: candidate(percent("c1", 1000, { code: SAVE })) },
    });
    expect(result.couponError).toBeNull();
    expect(result.couponOutcome).toEqual({ kind: "not_combinable" });
  });
});
